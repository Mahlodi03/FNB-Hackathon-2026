import styles from "./AssessmentRules.module.css";

/** Information shown before the existing acceptance checkbox and preflight. */
export function AssessmentRules({ isResume, durationMinutes }: { isResume: boolean; durationMinutes: number }) {
  return (
    <div className={styles.container}>
      <section className={styles.section} aria-labelledby="assessment-rules-heading">
        <h3 id="assessment-rules-heading">Rules for your assessment</h3>
        <ul>
          <li><strong>Use a desktop or laptop.</strong> You need HTTPS, a working camera and fullscreen support.</li>
          <li><strong>Complete the work independently.</strong> Avoid outside assistance, changing tabs or windows, and copy/paste during the assessment.</li>
          <li><strong>Keep monitoring active.</strong> Stay on the assessment page in fullscreen, keep the camera enabled and remain visible to the camera. Other faces may trigger a warning.</li>
          <li><strong>One attempt per challenge.</strong> You cannot start the same challenge again to reset your score or timer.</li>
          <li><strong>The original deadline applies.</strong> {isResume
            ? "Your existing timer continues. Restoring camera and fullscreen does not restart it."
            : `The ${durationMinutes}-minute timer starts when your attempt is created and does not pause if you leave or refresh.`}</li>
        </ul>
      </section>
      <section className={`${styles.section} ${styles.privacy}`} aria-labelledby="assessment-privacy-heading">
        <h3 id="assessment-privacy-heading">What is checked and saved</h3>
        <ul>
          <li><strong>No camera recording.</strong> The camera preview and face detection run on your device. Ready For Work does not record or upload video frames, screenshots or microphone audio.</li>
          <li><strong>Private integrity events.</strong> Tab and window focus changes, fullscreen exits, copy/paste attempts, camera interruptions and face-detection warnings may be saved with timestamps.</li>
          <li><strong>Periodic status reports.</strong> During an active attempt, the browser reports whether its camera track, fullscreen mode and page visibility appear active. These reports are stored, but are not independent proof of camera operation.</li>
          <li><strong>Fair review.</strong> Monitoring signals may be reviewed privately. A warning alone does not prove misconduct or change your grade.</li>
        </ul>
      </section>
    </div>
  );
}
