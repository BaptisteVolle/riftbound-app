// src/lib/string-similarity.ts

export function getLevenshteinDistance(left: string, right: string) {
  const leftLength = left.length;
  const rightLength = right.length;

  if (leftLength === 0) return rightLength;
  if (rightLength === 0) return leftLength;

  const previousRow = Array.from(
    { length: rightLength + 1 },
    (_, index) => index,
  );
  const currentRow = Array.from({ length: rightLength + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= leftLength; leftIndex += 1) {
    currentRow[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= rightLength; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      currentRow[rightIndex] = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index <= rightLength; index += 1) {
      previousRow[index] = currentRow[index];
    }
  }

  return previousRow[rightLength];
}

export function getStringSimilarity(left: string, right: string) {
  const normalizedLeft = left.trim();
  const normalizedRight = right.trim();

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  const distance = getLevenshteinDistance(normalizedLeft, normalizedRight);

  return Math.max(0, 1 - distance / maxLength);
}
