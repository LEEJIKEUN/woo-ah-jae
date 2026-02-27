export function sanitizeBoardText(input: string) {
  const trimmed = input.trim();
  return trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "");
}

export function clampText(input: string, maxLength: number) {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength);
}
