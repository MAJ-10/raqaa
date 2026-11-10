import logo from '../../assets/brand/logo.svg';
import { Button } from '../ui/Button.tsx';
import { CornerTiles } from '../ui/CornerTiles.tsx';

/**
 * The competition's intro page, when no competition is saved: the logo in the middle, the teams' tiles
 * coming in from the four corners (the identity's opening page), and «إنشاء غرفة» to start a new setup.
 */
export function IntroScreen({ onCreate }: { onCreate: () => void }) {
  return (
    <main className="intro">
      <CornerTiles />
      <div className="intro-center">
        <img className="intro-logo" src={logo} alt="رقعة" />
        <Button variant="primary" icon="plus" className="intro-create" onClick={onCreate}>
          إنشاء غرفة
        </Button>
      </div>
    </main>
  );
}
