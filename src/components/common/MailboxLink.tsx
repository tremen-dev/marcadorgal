"use client";

import { useEffect, useState } from "react";
import styles from "./MailboxLink.module.css";

type Props = {
  user?: string;
  domain?: string;
  subject?: string;
  className?: string;
  showIcon?: boolean;
};

/**
 * Obfuscated contact mailbox component (SPEC-058, CA-4).
 * Prevents raw email harvesting bots from scraping `ola@tremen.dev` on static SSR render,
 * whilst delivering full native `mailto:` interaction for real interactive users.
 */
export function MailboxLink({
  user = "ola",
  domain = "tremen.dev",
  subject,
  className,
  showIcon = false,
}: Props) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const email = `${user}@${domain}`;
  const href = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

  if (!isClient) {
    return (
      <span
        className={className ?? styles.mailboxText}
        title={`${user}@${domain}`}
      >
        {user} [en] {domain}
      </span>
    );
  }

  return (
    <a
      href={href}
      className={className ?? styles.mailboxLink}
      aria-label={`Enviar correo a ${email}`}
    >
      {email}
      {showIcon && (
        <span className={styles.icon} aria-hidden="true">
          {" "}
          ↗
        </span>
      )}
    </a>
  );
}
