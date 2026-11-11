import logo from '../../assets/brand/logo.svg';
import { Button } from '../ui/Button.tsx';
import { CornerTiles } from '../ui/CornerTiles.tsx';

type Props = { onCreate: () => void; onDemo: () => void };

/**
 * The competition's intro page, when no competition is saved: the logo in the middle, the teams' tiles
 * coming in from the four corners (the identity's opening page), «إنشاء غرفة» to start a new setup, and
 * under it, quietly, a demo competition that plays itself.
 */
export function IntroScreen({ onCreate, onDemo }: Props) {
  return (
    <main className="intro">
      <CornerTiles />
      <div className="intro-center">
        <img className="intro-logo" src={logo} alt="رقعة" />
        <div className="intro-actions">
          <Button variant="primary" icon="plus" className="intro-create" onClick={onCreate}>
            إنشاء غرفة
          </Button>
          <Button variant="quiet" icon="play" onClick={onDemo}>
            مسابقة تجريبية
          </Button>
        </div>
      </div>
    </main>
  );
}
