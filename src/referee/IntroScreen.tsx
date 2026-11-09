import logo from '../../assets/brand/logo.svg';
import { Button } from '../ui/Button.tsx';

/** The competition's intro page, when no competition is saved. «إنشاء غرفة» starts a new setup. */
export function IntroScreen({ onCreate }: { onCreate: () => void }) {
  return (
    <main className="intro">
      <img className="intro-logo" src={logo} alt="رقعة" />
      <Button variant="primary" icon="plus" className="intro-create" onClick={onCreate}>
        إنشاء غرفة
      </Button>
    </main>
  );
}
