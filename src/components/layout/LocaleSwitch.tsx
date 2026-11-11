"use client";

import { usePathname } from "next/navigation";
import { LOCALES, type Locale, t } from "@/i18n";
import { localePaths } from "@/lib/locale-paths";
import styles from "./Footer.module.css";

// SPEC-082 CA-2: gl·es, out of the Xornada header and into the footer of
// every public page (SPEC-058). Each link points at the same page in the
// other language (localePaths). On the Xornada, XornadaFilters adds the
// fragment to `data-locale-href` (SPEC-023 CA-4).
export function LocaleLinks({
  locale,
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  const paths = localePaths(pathname);
  return (
    <nav
      className={styles.locales}
      aria-label={t(locale, "xornada.locale")}
      data-testid="locale-switch"
    >
      {LOCALES.map((other, i) => (
        <span key={other} className={styles.localeItem}>
          {i > 0 && (
            <span className={styles.localeDot} aria-hidden="true">
              ·
            </span>
          )}
          <a
            className={other === locale ? styles.localeCurrent : styles.locale}
            href={paths[other]}
            hrefLang={other}
            lang={other}
            aria-current={other === locale ? "page" : undefined}
            data-locale-href={paths[other]}
          >
            {t(locale, `locales.${other}`)}
          </a>
        </span>
      ))}
    </nav>
  );
}

export function LocaleSwitch({ locale }: { locale: Locale }) {
  // Outside the App Router (unit tests) there is no pathname: the home.
  const pathname = usePathname() ?? (locale === "es" ? "/es" : "/");
  return <LocaleLinks locale={locale} pathname={pathname} />;
}
