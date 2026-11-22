import { Checkbox } from "../ui/checkbox";

export function OcrOption({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="my-3 flex items-center space-x-2">
      <Checkbox
        id="ocr"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onCheckedChange(c === true)}
      />
      <div>
        <label
          htmlFor="ocr"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          OCR Pdf
        </label>
        <span className="block text-xs text-muted-foreground">
          Convert scanned PDF into searchable and selectable document.
        </span>
      </div>
    </div>
  );
}
