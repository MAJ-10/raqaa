import cream from '../../assets/medad/medad-cream.png';
import teal from '../../assets/medad/medad-teal.png';

/**
 * The maker's signature at the foot of a page: «تم تطوير هذا النظام بواسطة» and the Medad wordmark, teal
 * on the day's sky and cream at night.
 */
export function MedadFoot({ night = false }: { night?: boolean }) {
  return (
    <p className="medad-foot" data-night={night || undefined}>
      تم تطوير هذا النظام بواسطة
      <img src={night ? cream : teal} alt="مداد" width={785} height={244} />
    </p>
  );
}
