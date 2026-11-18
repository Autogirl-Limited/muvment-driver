"use client";

import { useMemo, useState } from "react";
import { Banknote, ChevronDown, ClipboardCheck, FileText, Lock, MapPin, ShieldCheck, TriangleAlert, UserCheck, type LucideIcon } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import type { LegalDocument, LegalIcon } from "@/lib/data/legalDocuments";

interface LegalDocumentScreenProps {
  document: LegalDocument;
}

const ICONS: Record<LegalIcon, LucideIcon> = {
  banknote: Banknote,
  checklist: ClipboardCheck,
  invoice: FileText,
  locationFill: MapPin,
  lockFill: Lock,
  personCheck: UserCheck,
  privacy: ShieldCheck,
  shieldCheck: ShieldCheck,
  warning: TriangleAlert,
};

const IconTile = ({ icon, tint, size = 36 }: { icon: LegalIcon; tint: string; size?: number }) => {
  const Icon = ICONS[icon];

  return (
    <span className="flex shrink-0 items-center justify-center text-white" style={{ width: size, height: size, backgroundColor: tint, borderRadius: size * 0.27 }}>
      <Icon size={size * 0.52} />
    </span>
  );
};

interface LegalSection {
  body: string[];
  id: string;
  title: string;
}

const isTopLevelSectionHeading = (line: string) => /^\d+\.\s/.test(line);
const isNestedSectionHeading = (line: string) => /^\d+\.\d+\s/.test(line);

const parseLegalDocument = (body: string) => {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const sections: LegalSection[] = [];
  const metadata: string[] = [];
  let currentSection: LegalSection | undefined;

  lines.forEach((line, lineIndex) => {
    // The first line is the document's own title, shown above already.
    if (lineIndex === 0) return;
    if (line.startsWith("Operated by") || line.startsWith("Last updated:") || line.startsWith("Effective date:")) {
      metadata.push(line);
      return;
    }
    if (isTopLevelSectionHeading(line)) {
      currentSection = { body: [], id: line.match(/^\d+/)?.[0] ?? String(sections.length + 1), title: line };
      sections.push(currentSection);
      return;
    }
    currentSection?.body.push(line);
  });

  return { metadata, sections };
};

const SectionLine = ({ line }: { line: string }) => {
  if (line.startsWith("- ")) {
    return (
      <li className="text-callout flex items-start gap-3 text-text-2">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-text-4" />
        <span>{line.slice(2)}</span>
      </li>
    );
  }
  if (isNestedSectionHeading(line)) {
    return <li className="text-callout mt-3 mb-1 list-none font-semibold text-text">{line}</li>;
  }
  return <li className="text-callout mb-2 list-none text-text-2">{line}</li>;
};

export const LegalDocumentScreen = ({ document: legal }: LegalDocumentScreenProps) => {
  const { body, title } = legal;
  const document = useMemo(() => parseLegalDocument(body), [body]);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(document.sections[0]?.id ?? null);
  
  
  

  return (
    <Screen>
      <NavBar left={<BackButton />} largeTitle={title} subtitle={document.metadata.find((item) => item.startsWith("Operated by"))} />

      <div className="px-5 pb-12">
        <div className="mb-6 flex items-start gap-4">
          <IconTile icon={legal.icon} tint={legal.tint} size={64} />
          <p className="text-[16px] leading-[23px] text-text-2">{legal.intro}</p>
        </div>

        <SectionHeader>Document details</SectionHeader>
        <div className="card mb-6 divide-y divide-separator p-0">
          {legal.details.map((detail) => (
            <div key={detail.label} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-callout text-text-3">{detail.label}</span>
              <span className="text-body text-right font-medium text-text">{detail.value}</span>
            </div>
          ))}
        </div>

        <SectionHeader>In plain language</SectionHeader>
        <div className="card divide-y divide-separator p-0">
          {legal.summary.map((item) => (
            <div key={item.title} className="flex items-start gap-3 px-4 py-3.5">
              <IconTile icon={item.icon} tint={item.tint} />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-text">{item.title}</p>
                <p className="text-callout mt-0.5 text-text-2">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-footnote mb-6 ml-4 mt-2 text-text-3">
          This summary is here to help you understand the key points. It is not a substitute for the full {legal.title}, which is what applies.
        </p>

        <SectionHeader>Full text</SectionHeader>
        <div className="space-y-3">
          {document.sections.map((section) => {
            const isExpanded = expandedSectionId === section.id;

            return (
              <section key={section.id} className="card overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                  className="pressable-row flex w-full items-center gap-3 px-4 py-4 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[13px] font-bold text-accent">
                    {section.id}
                  </span>
                  <span className="text-headline flex-1 text-text">{section.title.replace(/^\d+\.\s/, "")}</span>
                  <ChevronDown
                    size={20}
                    className="shrink-0 text-text-4"
                    style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform var(--dur) var(--ease-spring)" }}
                  />
                </button>
                <div
                  className="grid"
                  style={{
                    gridTemplateRows: isExpanded ? "1fr" : "0fr",
                    transition: "grid-template-rows var(--dur) var(--ease-spring)",
                  }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <ul className="border-t border-separator px-4 pt-4 pb-3">
                      {section.body.map((line, index) => (
                        <SectionLine key={`${section.id}-${index}`} line={line} />
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <p className="text-footnote mx-4 mt-5 text-center text-text-3">{legal.agreement}</p>
      </div>
    </Screen>
  );
};
