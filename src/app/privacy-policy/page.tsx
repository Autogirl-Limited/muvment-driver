import { LegalDocumentScreen } from "@/components/legal/LegalDocumentScreen";
import { privacyPolicyDocument } from "@/lib/data/legalDocuments";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return <LegalDocumentScreen body={privacyPolicyDocument.body} title={privacyPolicyDocument.title} />;
}
