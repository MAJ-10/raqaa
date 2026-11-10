import { Button } from './Button.tsx';

type Props = {
  /** What will happen, in one sentence. */
  text: string;
  /** The button that does it, named for the result. */
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Asks in place before something that can't be taken back, instead of a browser dialog. */
export function Confirm({ text, confirm, onConfirm, onCancel }: Props) {
  return (
    <div className="confirm" role="group" aria-label={confirm}>
      <p>{text}</p>
      <div className="confirm-actions">
        <Button variant="primary" onClick={onConfirm}>
          {confirm}
        </Button>
        {/* Focus lands on «إلغاء», so a stray Enter keeps things as they are. */}
        <Button variant="quiet" autoFocus onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  );
}
