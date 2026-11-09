import { type Locale, t } from "@/i18n";
import type { LegalDocument } from "@/lib/legal/content";
import styles from "./LegalPage.module.css";

type Props = {
  document: LegalDocument;
  locale: Locale;
};

export function LegalPageView({ document, locale }: Props) {
  const homeHref = locale === "es" ? "/es" : "/";

  return (
    <main className={styles.page} data-testid="legal-page">
      <div className={styles.backRow}>
        <a
          href={homeHref}
          className={styles.backLink}
          data-testid="legal-back-link"
        >
          ← {t(locale, "legal.backToHome")}
        </a>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>{document.title}</h1>
        <p className={styles.description}>{document.description}</p>
        <p className={styles.lastUpdated}>
          {t(locale, "legal.lastUpdated", { date: document.lastUpdated })}
        </p>
      </header>

      <div className={styles.content}>
        {document.sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            {section.content.map((p) => (
              <p key={p.slice(0, 40)} className={styles.paragraph}>
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
