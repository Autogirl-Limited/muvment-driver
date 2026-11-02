"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Camera, CheckCircle2, Circle, ImagePlus, RefreshCw, ScanText, WifiOff, X } from "lucide-react";

import { PaymentTypeIcon } from "@/components/payments/PaymentBits";
import { BookingCardBody } from "@/components/payments/BookingPicker";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useAirportTicketOcr } from "@/lib/api/hooks/useDriverPayments";
import type {
  AirportTicketOcr,
  DriverPaymentRates,
  DriverPaymentRequest,
  EligibleTrip,
  PaymentRequestItemPayload,
  PaymentRequestType,
} from "@/lib/api/types";
import { formatHours, formatNaira, PAYMENT_TYPE_LABELS } from "@/lib/payments/labels";
import { capturePhoto, type PhotoSource } from "@/lib/utils/deviceActions";
import { formatLagosDayMonth, formatLagosShortDate, formatWeekday } from "@/lib/utils/lagosTime";
import { CHECKLIST_UPLOAD_FAILED_MESSAGE, uploadChecklistPhoto } from "@/lib/utils/mediaUpload";
import { useNetworkStatus } from "@/providers/NetworkStatusProvider";
import { useToast } from "@/providers/ToastProvider";

export interface PaymentRequestFormValue {
  items: PaymentRequestItemPayload[];
  comment?: string;
}

interface PaymentRequestFormProps {
  type: PaymentRequestType;
  trips: EligibleTrip[];
  rates?: DriverPaymentRates;
  mode: "create" | "edit";
  initial?: DriverPaymentRequest;
  submitting: boolean;
  onSubmit: (value: PaymentRequestFormValue) => void;
  onChangeBooking?: () => void;
}

const MAX_COMMENT = 500;

/* ------------------------------------------------------------------ small pieces */
const Section = ({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) => (
  <section className="mb-6">
    <p className="text-eyebrow mb-2 text-text-3">{title}</p>
    {children}
    {hint && <p className="text-footnote mt-2 text-text-4">{hint}</p>}
  </section>
);

const SelectRow = ({
  selected,
  disabled,
  multiple,
  onClick,
  title,
  description,
  trailing,
}: {
  selected: boolean;
  disabled?: boolean;
  multiple?: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) => (
  <button
    type="button"
    role={multiple ? "checkbox" : "radio"}
    aria-checked={selected}
    disabled={disabled}
    onClick={onClick}
    className="pressable-row flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-50"
  >
    {selected ? (
      <CheckCircle2 size={22} className="shrink-0 text-accent" />
    ) : (
      <Circle size={22} className={`shrink-0 ${disabled ? "text-border" : "text-border-strong"}`} />
    )}
    <span className="min-w-0 flex-1">
      <span className="text-body block font-medium text-text">{title}</span>
      {description && <span className="text-footnote block text-text-3">{description}</span>}
    </span>
    {trailing}
  </button>
);

/* ------------------------------------------------------------------ airport ticket */
type AirportField = "airportName" | "entryAt" | "exitAt" | "ticketNumber" | "amount";

const AIRPORT_FIELDS: Array<{ key: AirportField; label: string; inputType: string; placeholder: string }> = [
  { key: "airportName", label: "Airport", inputType: "text", placeholder: "e.g. MMIA Lagos" },
  { key: "entryAt", label: "Time in", inputType: "datetime-local", placeholder: "" },
  { key: "exitAt", label: "Time out", inputType: "datetime-local", placeholder: "" },
  { key: "ticketNumber", label: "Ticket number", inputType: "text", placeholder: "As printed on the ticket" },
  { key: "amount", label: "Amount paid (₦)", inputType: "number", placeholder: "0" },
];

type AirportValues = Record<AirportField, string>;

/** "2026-10-25T07:10:00" → "2026-10-25T07:10" for datetime-local inputs. */
const toInputDateTime = (value?: string | null) => (value ? value.slice(0, 16) : "");

const ocrToValues = (ocr?: AirportTicketOcr | null): Partial<AirportValues> => ({
  airportName: ocr?.airportName ?? undefined,
  entryAt: toInputDateTime(ocr?.entryAt) || undefined,
  exitAt: toInputDateTime(ocr?.exitAt) || undefined,
  ticketNumber: ocr?.ticketNumber ?? undefined,
  amount: ocr?.amount !== null && ocr?.amount !== undefined ? String(ocr.amount) : undefined,
});

const formatOcrValue = (key: AirportField, value: string) =>
  key === "amount" ? formatNaira(Number(value)) : key === "entryAt" || key === "exitAt" ? value.replace("T", " ") : value;

type TicketPhoto = { id: string; previewUrl: string; status: "uploading" | "done" | "error"; url?: string };

const isAirportValid = (values: AirportValues) =>
  AIRPORT_FIELDS.every(({ key }) => values[key].trim().length > 0) &&
  Number(values.amount) > 0 &&
  values.exitAt >= values.entryAt;

/* ------------------------------------------------------------------ form */
export const PaymentRequestForm = ({
  type,
  trips,
  rates,
  mode,
  initial,
  submitting,
  onSubmit,
  onChangeBooking,
}: PaymentRequestFormProps) => {
  const toast = useToast();
  const { isOnline } = useNetworkStatus();
  const ocrMutation = useAirportTicketOcr();
  const singleItem = mode === "edit";
  const trip = trips[0];
  const unitRate = rates?.[type]?.amount ?? initial?.unitRate ?? null;

  /* -- dates (OFF_DAY / INTERSTATE) */
  const [selectedDates, setSelectedDates] = useState<string[]>(() => (initial?.workDate ? [initial.workDate] : []));
  const dateMultiple = type === "INTERSTATE" && !singleItem;

  /* -- overtimes (EXTRA_HOURS): every unclaimed overtime of the chosen bookings is ticked */
  const [selectedOvertimes, setSelectedOvertimes] = useState<string[]>(() =>
    initial?.overtimeId
      ? [initial.overtimeId]
      : trips.flatMap((item) => (item.overtimes ?? []).filter((overtime) => !overtime.claimed).map((overtime) => overtime.overtimeId)),
  );

  /* -- airport ticket */
  const initialAirport = initial?.airport;
  const [airportValues, setAirportValues] = useState<AirportValues>({
    airportName: initialAirport?.airportName ?? "",
    entryAt: toInputDateTime(initialAirport?.entryAt),
    exitAt: toInputDateTime(initialAirport?.exitAt),
    ticketNumber: initialAirport?.ticketNumber ?? "",
    amount: initialAirport?.amount !== null && initialAirport?.amount !== undefined ? String(initialAirport.amount) : "",
  });
  const [ocr, setOcr] = useState<AirportTicketOcr | null>(initialAirport?.ocr ?? null);
  const [photos, setPhotos] = useState<TicketPhoto[]>(() =>
    (initial?.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      previewUrl: attachment.url,
      status: "done" as const,
      url: attachment.url,
    })),
  );
  const ocrRequestedRef = useRef(Boolean(initialAirport?.ocr));
  const [comment, setComment] = useState(initial?.comment ?? "");

  const ocrValues = useMemo(() => ocrToValues(ocr), [ocr]);

  /* -- totals */
  const overtimeHours = useMemo(
    () =>
      trips
        .flatMap((item) => item.overtimes ?? [])
        .filter((overtime) => selectedOvertimes.includes(overtime.overtimeId))
        .reduce((sum, overtime) => sum + overtime.hours, 0),
    [selectedOvertimes, trips],
  );
  const total =
    type === "AIRPORT_TICKET"
      ? Number(airportValues.amount) || 0
      : type === "EXTRA_HOURS"
        ? overtimeHours * (unitRate ?? 0)
        : selectedDates.length * (unitRate ?? 0);

  /* -- photos */
  const uploadPhoto = async (source: PhotoSource) => {
    if (!trip) return;
    const captured = await capturePhoto("environment", source);
    if (!captured) return;

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setPhotos((current) => [...current, { id, previewUrl: captured.previewUrl, status: "uploading" }]);

    try {
      const result = await uploadChecklistPhoto(captured.file, "airport-ticket", trip.tripId);
      setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, status: "done", url: result.fileUrl } : photo)));

      if (!ocrRequestedRef.current) {
        ocrRequestedRef.current = true;
        void readTicket(result.fileUrl);
      }
    } catch (error) {
      setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, status: "error" } : photo)));
      toast.error("Upload failed", getApiErrorMessage(error) ?? CHECKLIST_UPLOAD_FAILED_MESSAGE);
    }
  };

  const readTicket = async (imageUrl: string) => {
    try {
      const response = await ocrMutation.mutateAsync({ imageUrl });
      const result = response.data;
      setOcr(result);
      const filled = ocrToValues(result);
      // Fill only what the driver hasn't typed yet.
      setAirportValues((current) => {
        const next = { ...current };
        (Object.keys(filled) as AirportField[]).forEach((key) => {
          const value = filled[key];
          if (value && !current[key].trim()) next[key] = value;
        });
        return next;
      });
      if (!result.readable) {
        toast.info("Couldn't read the ticket", "Please fill in the details yourself.");
      }
    } catch (error) {
      ocrRequestedRef.current = false;
      toast.error("Couldn't read the ticket", getApiErrorMessage(error) ?? "Please fill in the details yourself.");
    }
  };

  const removePhoto = (id: string) => setPhotos((current) => current.filter((photo) => photo.id !== id));

  /* -- submit */
  const uploadedPhotoUrls = photos.filter((photo) => photo.status === "done" && photo.url).map((photo) => photo.url as string);
  const isUploading = photos.some((photo) => photo.status === "uploading");

  const items: PaymentRequestItemPayload[] = useMemo(() => {
    if (!trip) return [];

    switch (type) {
      case "OFF_DAY":
      case "INTERSTATE":
        return selectedDates.map((workDate) => ({ tripId: trip.tripId, workDate }));
      case "EXTRA_HOURS":
        return trips.flatMap((item) =>
          (item.overtimes ?? [])
            .filter((overtime) => selectedOvertimes.includes(overtime.overtimeId))
            .map((overtime) => ({ tripId: item.tripId, overtimeId: overtime.overtimeId, hoursClaimed: overtime.hours })),
        );
      case "AIRPORT_TICKET":
        return [
          {
            tripId: trip.tripId,
            airportName: airportValues.airportName.trim(),
            entryAt: airportValues.entryAt ? `${airportValues.entryAt}:00` : undefined,
            exitAt: airportValues.exitAt ? `${airportValues.exitAt}:00` : undefined,
            ticketNumber: airportValues.ticketNumber.trim(),
            amount: Number(airportValues.amount) || undefined,
            attachmentUrls: uploadedPhotoUrls,
            ocr,
          },
        ];
    }
  }, [airportValues, ocr, selectedDates, selectedOvertimes, trip, trips, type, uploadedPhotoUrls]);

  const blocker = !isOnline
    ? "You're offline. Payment requests can only be sent while online."
    : items.length === 0
      ? type === "EXTRA_HOURS"
        ? "Choose at least one overtime invoice."
        : type === "AIRPORT_TICKET"
          ? undefined
          : "Choose the date you worked."
      : type === "AIRPORT_TICKET" && uploadedPhotoUrls.length === 0
        ? "Add a photo of the ticket."
        : type === "AIRPORT_TICKET" && isUploading
          ? "Wait for the photo to finish uploading."
          : type === "AIRPORT_TICKET" && !isAirportValid(airportValues)
            ? "Fill in every ticket detail. Time out must be after time in."
            : undefined;

  const handleSubmit = () => {
    if (blocker || submitting) return;
    onSubmit({ items, comment: comment.trim() || undefined });
  };

  if (!trip) {
    return null;
  }

  const toggleDate = (date: string) =>
    setSelectedDates((current) =>
      dateMultiple ? (current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort()) : [date],
    );

  return (
    <div className="pb-8">
      <div className="mb-6 flex items-center gap-3">
        <PaymentTypeIcon type={type} />
        <div className="min-w-0 flex-1">
          <p className="text-headline text-text">{PAYMENT_TYPE_LABELS[type]}</p>
          <p className="text-footnote text-text-3">
            {unitRate !== null
              ? `${formatNaira(unitRate)} ${type === "EXTRA_HOURS" ? "per hour" : "per day"}`
              : type === "AIRPORT_TICKET"
                ? "The amount on the ticket"
                : ""}
          </p>
        </div>
      </div>

      <Section title={trips.length > 1 ? "Bookings" : "Booking"}>
        <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
          {trips.map((item) => (
            <div key={item.tripId} className="flex items-start gap-3 px-4 py-3">
              <BookingCardBody trip={{ ...item, eligible: true }} type={type} />
            </div>
          ))}
        </div>
        {onChangeBooking && (
          <button type="button" onClick={onChangeBooking} className="pressable-soft text-callout mt-2 ml-1 font-medium text-accent">
            Change booking
          </button>
        )}
      </Section>

      {(type === "OFF_DAY" || type === "INTERSTATE") && (
        <Section
          title={dateMultiple ? "Days on the interstate trip" : "Date worked"}
          hint={
            type === "OFF_DAY"
              ? "Only this booking's dates are shown. The date must be an off day in your schedule."
              : "One request is made for each day you choose."
          }
        >
          <div
            className="inset-group [&>*+*]:border-t [&>*+*]:border-separator"
            role={dateMultiple ? "group" : "radiogroup"}
            aria-label="Dates"
          >
            {(trip.dates ?? []).length === 0 && (
              <p className="text-callout px-4 py-3 text-text-3">This booking has no dates to claim.</p>
            )}
            {(trip.dates ?? []).map((date) => {
              const isCurrent = initial?.workDate === date.date;
              const claimed = date.claimed && !isCurrent;
              return (
                <SelectRow
                  key={date.date}
                  multiple={dateMultiple}
                  selected={selectedDates.includes(date.date)}
                  disabled={claimed}
                  onClick={() => toggleDate(date.date)}
                  title={`${formatWeekday(date.weekday) || formatLagosShortDate(date.date)?.split(" ")[0] || ""}, ${formatLagosDayMonth(date.date) ?? date.date}`}
                  description={
                    claimed
                      ? "Already claimed"
                      : type === "OFF_DAY" && date.offDay === true
                        ? "Off day in your schedule"
                        : type === "OFF_DAY" && date.offDay === false
                          ? "Your schedule shows a working day"
                          : undefined
                  }
                  trailing={
                    type === "OFF_DAY" && date.offDay === true && !claimed ? <Pill tone="success">Off day</Pill> : undefined
                  }
                />
              );
            })}
          </div>
        </Section>
      )}

      {type === "EXTRA_HOURS" && (
        <Section title="Overtime billed by customer support" hint="Hours are the hours customer support billed. You're paid once the customer has paid.">
          <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
            {trips.flatMap((item) =>
              (item.overtimes ?? []).map((overtime) => {
                const isCurrent = initial?.overtimeId === overtime.overtimeId;
                const claimed = overtime.claimed && !isCurrent;
                const paid = overtime.paymentStatus === "PAID";
                return (
                  <SelectRow
                    key={overtime.overtimeId}
                    multiple
                    selected={selectedOvertimes.includes(overtime.overtimeId)}
                    disabled={claimed || singleItem}
                    onClick={() =>
                      setSelectedOvertimes((current) =>
                        current.includes(overtime.overtimeId)
                          ? current.filter((id) => id !== overtime.overtimeId)
                          : [...current, overtime.overtimeId],
                      )
                    }
                    title={`${overtime.invoiceNumber} · ${formatHours(overtime.hours)}`}
                    description={claimed ? "Already claimed" : `${item.invoiceNumber ?? "Booking"} · ${formatNaira(overtime.hours * (unitRate ?? 0))}`}
                    trailing={
                      <Pill tone={paid ? "success" : "warning"}>{paid ? "Customer paid" : "Customer not paid"}</Pill>
                    }
                  />
                );
              }),
            )}
          </div>
        </Section>
      )}

      {type === "AIRPORT_TICKET" && (
        <>
          <Section title="Ticket photos" hint="Take a clear photo of the whole ticket. We read the details from the first photo.">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="md" icon={<Camera size={18} />} onClick={() => void uploadPhoto("camera")}>
                Take photo
              </Button>
              <Button variant="outline" size="md" icon={<ImagePlus size={18} />} onClick={() => void uploadPhoto("gallery")}>
                From gallery
              </Button>
            </div>
            {photos.length > 0 && (
              <div className="scrollbar-none -mx-5 mt-3 flex gap-3 overflow-x-auto px-5">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-alt">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob/R2 preview */}
                    <img src={photo.previewUrl} alt="Ticket" className="h-full w-full object-cover" />
                    {photo.status === "uploading" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-scrim text-white">
                        <Spinner size={22} />
                      </div>
                    )}
                    {photo.status === "error" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-danger/70 text-[12px] font-semibold text-white">
                        Failed
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                      aria-label="Remove photo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {ocrMutation.isPending && (
              <p className="text-footnote mt-3 flex items-center gap-2 text-accent-text">
                <Spinner size={14} /> Reading the ticket...
              </p>
            )}
            {!ocrMutation.isPending && uploadedPhotoUrls.length > 0 && !ocr && (
              <button
                type="button"
                onClick={() => {
                  ocrRequestedRef.current = true;
                  void readTicket(uploadedPhotoUrls[0]);
                }}
                className="pressable-soft text-callout mt-3 flex items-center gap-1.5 font-medium text-accent"
              >
                <RefreshCw size={15} /> Read the ticket
              </button>
            )}
          </Section>

          <Section title="Ticket details">
            {ocr && (
              <p className="text-footnote mb-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-accent-text">
                <ScanText size={16} className="mt-[1px] shrink-0" />
                Filled from the ticket. Check each value against the photo.
              </p>
            )}
            {AIRPORT_FIELDS.map(({ key, label, inputType, placeholder }) => {
              const value = airportValues[key];
              const fromTicket = ocrValues[key];
              const edited = Boolean(fromTicket) && value.trim() !== fromTicket;
              const missing = Boolean(ocr) && !fromTicket && !value.trim();
              return (
                <div key={key} className="mb-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor={`airport-${key}`} className="text-callout font-medium text-text">
                      {label}
                    </label>
                    {fromTicket && !edited && <Pill tone="accent">From ticket</Pill>}
                    {edited && <Pill tone="warning">Edited</Pill>}
                    {missing && <Pill tone="warning">Not read</Pill>}
                  </div>
                  <input
                    id={`airport-${key}`}
                    type={inputType}
                    inputMode={key === "amount" ? "numeric" : undefined}
                    value={value}
                    placeholder={placeholder}
                    min={key === "amount" ? 0 : undefined}
                    onChange={(event) => setAirportValues((current) => ({ ...current, [key]: event.target.value }))}
                    className={`hide-number-spin h-12 w-full rounded-xl border bg-surface px-4 text-[16px] text-text outline-none placeholder:text-text-4 focus:border-accent ${
                      missing ? "border-warning bg-warning-soft" : "border-border-strong"
                    }`}
                  />
                  {missing && (
                    <p className="text-footnote mt-1.5 ml-1 text-warning-text">
                      Couldn&apos;t read this from the ticket. Please fill it in.
                    </p>
                  )}
                  {edited && fromTicket && (
                    <p className="text-footnote mt-1.5 ml-1 text-text-3">
                      Ticket says {formatOcrValue(key, fromTicket)}. The reviewer sees both.
                    </p>
                  )}
                </div>
              );
            })}
          </Section>
        </>
      )}

      <Section title="Comment (optional)">
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT))}
          rows={3}
          placeholder="Anything the reviewer should know"
          className="w-full resize-none rounded-xl border border-border-strong bg-surface px-4 py-3 text-[16px] text-text outline-none placeholder:text-text-4 focus:border-accent"
        />
      </Section>

      <div className="card mb-4 flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-footnote text-text-3">
            {type === "EXTRA_HOURS"
              ? `${formatHours(overtimeHours)} × ${formatNaira(unitRate)}`
              : type === "AIRPORT_TICKET"
                ? "Ticket amount"
                : `${selectedDates.length} day${selectedDates.length === 1 ? "" : "s"} × ${formatNaira(unitRate)}`}
          </p>
          <p className="text-footnote text-text-4">
            {items.length > 1 ? `${items.length} requests will be created` : "Paid once verified"}
          </p>
        </div>
        <p className="text-title-2 tabular-nums text-text">{formatNaira(total)}</p>
      </div>

      {blocker && (
        <p className="text-footnote mb-3 flex items-start gap-2 text-warning-text">
          {!isOnline ? <WifiOff size={15} className="mt-[1px] shrink-0" /> : <AlertTriangle size={15} className="mt-[1px] shrink-0" />}
          {blocker}
        </p>
      )}

      <Button loading={submitting} disabled={Boolean(blocker)} onClick={handleSubmit}>
        {mode === "edit" ? "Save changes" : items.length > 1 ? `Submit ${items.length} requests` : "Submit request"}
      </Button>
    </div>
  );
};
