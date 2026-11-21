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
    <div className="flex items-start gap-2">
      <Checkbox
        id="ocr"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-0.5"
      />
      <div>
        <label
          htmlFor="ocr"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          OCR scanned pages
        </label>
        <span className="block text-xs text-muted-foreground">
          Make scanned pages searchable and selectable.
        </span>
      </div>
    </div>
  );
}
