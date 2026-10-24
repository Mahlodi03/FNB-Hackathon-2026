/** A concise directory summary using only information the student supplied. */
export function studentSummary(student: {
  bio: string | null;
  fieldOfInterest: string | null;
  institution: string | null;
}): string {
  const bio = student.bio?.replace(/\s+/g, " ").trim();
  if (bio) {
    const limit = 178;
    if (bio.length <= limit) return bio;
    const cut = bio.slice(0, limit + 1);
    const wordBoundary = cut.lastIndexOf(" ");
    return `${cut.slice(0, wordBoundary >= 110 ? wordBoundary : limit).trimEnd()}…`;
  }
  if (student.fieldOfInterest) return `Interested in ${student.fieldOfInterest}.`;
  if (student.institution) return `Studying at ${student.institution}.`;
  return "This student hasn't added a personal introduction yet.";
}
