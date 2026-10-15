export function focusFirstInvalid(root: ParentNode | null | undefined): void {
  root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
