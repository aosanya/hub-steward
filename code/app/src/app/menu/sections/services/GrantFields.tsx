import { Field } from "../../../../shared/ui/Field";
import { certificateWords, validUntilWords } from "./decision";

type Props = { certificate: string; validUntil: string; onCertificate: (value: string) => void; onValidUntil: (value: string) => void };

export const grantExtras = (certificate: string, validUntil: string) => ({
  ...(certificate.trim() === "" ? {} : { certificate_ref: certificate.trim() }),
  ...(validUntil.trim() === "" ? {} : { valid_until: validUntil.trim() }),
});

export function GrantFields({ certificate, validUntil, onCertificate, onValidUntil }: Props) {
  return (
    <>
      <Field label={certificateWords} value={certificate} onChange={(event) => onCertificate(event.target.value)} />
      <Field label={validUntilWords} type="date" value={validUntil} onChange={(event) => onValidUntil(event.target.value)} />
    </>
  );
}
