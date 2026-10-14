export const isPdfResume = (file) =>
  Boolean(
    file &&
      typeof file.name === "string" &&
      file.name.toLowerCase().endsWith(".pdf") &&
      (!file.type || file.type === "application/pdf")
  );
