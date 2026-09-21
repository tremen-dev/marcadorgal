import { type Locale, t } from "@/i18n";
import styles from "./WaitingPage.module.css";

type Props = { locale: Locale };

const otherLocaleHref: Record<Locale, string> = { gl: "/es", es: "/" };

export function WaitingPage({ locale }: Props) {
  return (
    <main className={styles.main}>
      <div className={styles.logo} data-testid="logo">
        marcador
        <span className={styles.mark} data-testid="logo-mark">
          ▮
        </span>
        gal
      </div>
      <div>
        <h1 className={styles.heading}>{t(locale, "waiting.heading")}</h1>
        <p className={styles.waiting}>{t(locale, "waiting.body")}</p>
      </div>
      <footer className={styles.footer}>
        <a
          className={styles.switch}
          href={otherLocaleHref[locale]}
          hrefLang={locale === "gl" ? "es" : "gl"}
        >
          {t(locale, "common.switchLocale")}
        </a>
      </footer>
    </main>
  );
}
