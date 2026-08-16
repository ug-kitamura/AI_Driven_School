function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitFileName(fileName: string): { base: string; ext: string } {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) {
    return { base: fileName, ext: "" };
  }
  return {
    base: fileName.slice(0, dot),
    ext: fileName.slice(dot),
  };
}

export function resolveUniqueFileName(
  existingNames: string[],
  desiredName: string,
): string {
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }

  const { base, ext } = splitFileName(desiredName);
  let maxN = 1;
  const numberedPattern = new RegExp(
    `^${escapeRegExp(base)}-(\\d+)${escapeRegExp(ext)}$`,
  );

  for (const name of existingNames) {
    if (name === `${base}${ext}`) {
      maxN = Math.max(maxN, 1);
      continue;
    }
    const match = name.match(numberedPattern);
    if (match) {
      maxN = Math.max(maxN, Number.parseInt(match[1] ?? "0", 10));
    }
  }

  return `${base}-${maxN + 1}${ext}`;
}

export function resolveUniqueFolderName(
  existingNames: string[],
  desiredName: string,
): string {
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }

  let maxN = 1;
  const numberedPattern = new RegExp(`^${escapeRegExp(desiredName)}-(\\d+)$`);

  for (const name of existingNames) {
    if (name === desiredName) {
      maxN = Math.max(maxN, 1);
      continue;
    }
    const match = name.match(numberedPattern);
    if (match) {
      maxN = Math.max(maxN, Number.parseInt(match[1] ?? "0", 10));
    }
  }

  return `${desiredName}-${maxN + 1}`;
}
