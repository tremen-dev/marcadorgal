import { type Locale, t } from "@/i18n";
import { LEGAL_ROUTES, MARCA } from "@/lib/legal/content";
import { getAppVersionDisplay } from "@/lib/version";
import { MailboxLink } from "../common/MailboxLink";
import styles from "./Footer.module.css";

type Props = {
  locale: Locale;
};

export function Footer({ locale }: Props) {
  const routes = LEGAL_ROUTES[locale];
  const version = getAppVersionDisplay();
  const homeHref = locale === "es" ? "/es" : "/";

  return (
    <footer className={styles.footer} data-testid="app-footer">
      <div className={styles.inner}>
        {/* Top row: Brand + Version on left, Legal links + Mailbox on right */}
        <div className={styles.topRow}>
          <div className={styles.brandVersion}>
            <a
              href={homeHref}
              className={styles.brandName}
              aria-label={t(locale, "common.title")}
            >
              marcador<span className={styles.brandMark}>▮</span>gal
            </a>
            <span
              className={styles.versionBadge}
              data-testid="footer-version"
              title={`${t(locale, "footer.version")}: ${version}`}
            >
              {version}
            </span>
          </div>

          <nav
            className={styles.navLinks}
            aria-label={t(locale, "footer.legalNotice")}
          >
            <a
              href={routes.avisoLegal}
              className={styles.navLink}
              data-testid="link-aviso-legal"
            >
              {t(locale, "footer.legalNotice")}
            </a>
            <span className={styles.navDot} aria-hidden="true">
              ·
            </span>
            <a
              href={routes.privacidade}
              className={styles.navLink}
              data-testid="link-privacidade"
            >
              {t(locale, "footer.privacy")}
            </a>
            <span className={styles.navDot} aria-hidden="true">
              ·
            </span>
            <a
              href={routes.cookies}
              className={styles.navLink}
              data-testid="link-cookies"
            >
              {t(locale, "footer.cookies")}
            </a>
            <span className={styles.navDot} aria-hidden="true">
              ·
            </span>
            <MailboxLink className={styles.navLink} />
          </nav>
        </div>

        {/* Bottom row: Disclaimer & Copyright on left, {tremen.dev} lockup on right */}
        <div className={styles.bottomRow}>
          <p className={styles.disclaimer} data-testid="footer-disclaimer">
            © 2026 marcador.gal · {t(locale, "footer.disclaimer")}
          </p>

          <div className={styles.byRow}>
            <span>{t(locale, "footer.by")}</span>
            <a
              href={MARCA.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.lockup}
              aria-label={MARCA.nombre}
              data-testid="tremen-lockup"
            >
              <span className={styles.lockupBr}>{"{"}</span>
              <span>tremen</span>
              <span className={styles.lockupDev}>.dev</span>
              <span className={styles.lockupBr}>{"}"}</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
