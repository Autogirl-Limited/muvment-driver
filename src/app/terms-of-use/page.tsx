import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { termsOfUseDocument } from "@/lib/data/legalDocuments";

export const metadata = { title: "Employee Terms of Use" };

export default function TermsOfUsePage() {
  return <LegalDocumentScreen body={termsOfUseDocument.body} title={termsOfUseDocument.title} />;
}
