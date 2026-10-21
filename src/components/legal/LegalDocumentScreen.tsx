"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { NavBar, Screen } from "@/components/ui/Screen";

interface LegalDocumentScreenProps {
  body: string;
  title: string;
}

interface LegalSection {
  body: string[];
  id: string;
  title: string;
}

const isTopLevelSectionHeading = (line: string) => /^\d+\.\s/.test(line);
const isNestedSectionHeading = (line: string) => /^\d+\.\d+\s/.test(line);
const isDocumentTitle = (line: string) =>
  ["Muvment Privacy Policy", "Muvment Terms of Use", "Employee Terms of Use", "Terms of service - Drivers"].includes(line);

const parseLegalDocument = (body: string) => {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const sections: LegalSection[] = [];
  const metadata: string[] = [];
  let currentSection: LegalSection | undefined;

  lines.forEach((line) => {
    if (isDocumentTitle(line)) return;
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

const getMetadataValue = (metadata: string[], label: string) =>
  metadata.find((item) => item.startsWith(label))?.replace(label, "").trim();

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

export const LegalDocumentScreen = ({ body, title }: LegalDocumentScreenProps) => {
  const document = useMemo(() => parseLegalDocument(body), [body]);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(document.sections[0]?.id ?? null);
  const lastUpdated = getMetadataValue(document.metadata, "Last updated:");
  const effectiveDate = getMetadataValue(document.metadata, "Effective date:");
  const operatedBy = document.metadata.find((item) => item.startsWith("Operated by"));

  return (
    <Screen>
      <NavBar left={<BackButton />} largeTitle={title} subtitle={operatedBy} />

      <div className="px-5 pb-12">
        {(lastUpdated || effectiveDate) && (
          <div className="mb-5 flex flex-wrap gap-2">
            {lastUpdated && (
              <div className="rounded-xl border border-border bg-surface px-3 py-2">
                <p className="text-caption text-text-3">Last updated</p>
                <p className="text-callout font-semibold text-text">{lastUpdated}</p>
              </div>
            )}
            {effectiveDate && (
              <div className="rounded-xl border border-border bg-surface px-3 py-2">
                <p className="text-caption text-text-3">Effective date</p>
                <p className="text-callout font-semibold text-text">{effectiveDate}</p>
              </div>
            )}
          </div>
        )}

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
      </div>
    </Screen>
  );
};
