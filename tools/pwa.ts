// Build plugins for the two outputs:
//   website()    → dist/: icon, manifest, security policy and the offline service worker (sw.js).
//   singleFile() → dist/raqaa.html: one self-contained page that opens by double-click (file://).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { HtmlTagDescriptor, Plugin, PluginOption } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const THEME_COLOR = '#F2F7FF'; // --sky in assets/tokens.css

// The app makes no network requests of its own. These policies make the browser enforce that.
const WEBSITE_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const SINGLE_FILE_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Written into the page as text, first in <head>, so the quotes stay readable ('self' rather than &#39;self&#39;).
function withPolicy(html: string, content: string): string {
  return html.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${content}">`);
}

const themeColor: HtmlTagDescriptor = {
  tag: 'meta',
  attrs: { name: 'theme-color', content: THEME_COLOR },
  injectTo: 'head',
};

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

export function website(): Plugin {
  let root = '';
  let publicDir = '';
  return {
    name: 'raqaa:website',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    transformIndexHtml(html, ctx) {
      const tags: HtmlTagDescriptor[] = [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: './icons/mark.svg' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'manifest', href: './manifest.webmanifest' }, injectTo: 'head' },
        themeColor,
      ];
      // The dev server injects inline scripts of its own, so the policy applies to builds only.
      return { html: ctx.server ? html : withPolicy(html, WEBSITE_POLICY), tags };
    },
    generateBundle(_options, bundle) {
      // Precache every built file and every public file. The version is a hash of all of them,
      // so any change makes a new sw.js, which the browser installs for the next time the app opens.
      const files = new Map<string, string | Uint8Array>();
      for (const [name, item] of Object.entries(bundle)) {
        files.set(name, item.type === 'chunk' ? item.code : item.source);
      }
      if (publicDir) {
        for (const file of listFiles(publicDir)) {
          files.set(relative(publicDir, file).split(sep).join('/'), readFileSync(file));
        }
      }
      const names = [...files.keys()].sort();
      const hash = createHash('sha256');
      for (const name of names) hash.update(name).update(files.get(name)!);
      const source = readFileSync(join(root, 'tools', 'sw-template.js'), 'utf8')
        .replace('__RAQAA_VERSION__', hash.digest('hex').slice(0, 16))
        .replace('__RAQAA_FILES__', JSON.stringify(names));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export function singleFile(fileName: string): PluginOption[] {
  let root = '';
  return [
    viteSingleFile({ outputFileName: fileName }),
    {
      name: 'raqaa:single-file',
      configResolved(config) {
        root = config.root;
      },
      transformIndexHtml(html) {
        const mark = readFileSync(join(root, 'assets', 'brand', 'mark.svg')).toString('base64');
        const tags: HtmlTagDescriptor[] = [
          {
            tag: 'link',
            attrs: { rel: 'icon', type: 'image/svg+xml', href: `data:image/svg+xml;base64,${mark}` },
            injectTo: 'head',
          },
          themeColor,
        ];
        return { html: withPolicy(html, SINGLE_FILE_POLICY), tags };
      },
    },
  ];
}
