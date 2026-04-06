const hasValue = (value: string | undefined) => Boolean(value && value.trim().length > 0);

export function getPrivacyContactEmail() {
  const value = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL;
  if (!hasValue(value)) {
    return null;
  }

  const normalized = value!.trim();
  return normalized.includes("@") ? normalized : null;
}

export function getPrivacyMailtoHref(subject: string) {
  const email = getPrivacyContactEmail();
  if (!email) {
    return null;
  }

  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
