export type DateRangeQuickPickerProps = {
  startDate: string;
  endDate: string;
  onApply: (nextStart: string, nextEnd: string) => void;
  layout?: 'horizontal' | 'vertical';
  inline?: boolean;
  dropdownPosition?: 'relative' | 'absolute';
};