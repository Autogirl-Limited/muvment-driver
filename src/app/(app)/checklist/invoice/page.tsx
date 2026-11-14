"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ReceiptText } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { NavBar, Screen } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useLookupChecklistInvoiceVehicles, useTodayChecklist } from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { ChecklistInvoiceVehicle } from "@/lib/api/types";
import { getPreRideStarterStepRoute } from "@/lib/utils/checklistNavigation";
import { writeChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";

export default function ChecklistInvoicePage() {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>();
  const [vehicles, setVehicles] = useState<ChecklistInvoiceVehicle[]>([]);
  const currentUserQuery = useCurrentUser();
  const todayChecklistQuery = useTodayChecklist();
  const lookupVehicles = useLookupChecklistInvoiceVehicles();
  const normalizedInvoiceNumber = invoiceNumber.trim();
  const currentUserId = currentUserQuery.data?.data.userId?.trim();
  const todayState = todayChecklistQuery.data?.data.state ?? todayChecklistQuery.data?.data.status;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const canStartReport = Boolean(
    selectedVehicle && currentUserId && todayState === "NOT_STARTED",
  );

  const findVehicles = async () => {
    if (!normalizedInvoiceNumber || lookupVehicles.isPending) return;

    setSelectedVehicleId(undefined);
    setVehicles([]);

    try {
      setVehicles(await lookupVehicles.mutateAsync(normalizedInvoiceNumber));
    } catch {
      // The inline error below keeps the failure beside the invoice field.
    }
  };

  const startReport = () => {
    if (!selectedVehicle || !currentUserId || todayState !== "NOT_STARTED") return;

    writeChecklistVehicleSelection(currentUserId, {
      invoiceNumber: normalizedInvoiceNumber,
      vehicle: selectedVehicle,
    });
    router.push(getPreRideStarterStepRoute(1));
  };

  return (
    <Screen>
      <NavBar
        left={<BackButton href="/home" />}
        largeTitle="Start trip with invoice"
        subtitle="Enter the booking invoice number to find the vehicle for this trip."
      />

      <div className="flex flex-1 flex-col px-5 pb-8">
        <label className="mt-3 block">
          <span className="text-footnote mb-2 block font-medium text-text">Booking invoice number</span>
          <div className="relative">
            <ReceiptText
              size={19}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-4"
            />
            <input
              value={invoiceNumber}
              onChange={(event) => {
                setInvoiceNumber(event.target.value.toUpperCase());
                setSelectedVehicleId(undefined);
                setVehicles([]);
                if (lookupVehicles.isError) lookupVehicles.reset();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void findVehicles();
              }}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="Enter invoice number"
              className="h-12 w-full rounded-xl border border-border-strong bg-surface pr-4 pl-11 text-[16px] text-text uppercase outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(6,115,255,0.15)]"
            />
          </div>
        </label>

        {lookupVehicles.isError && (
          <p role="alert" className="text-footnote mt-2 text-danger">
            {getApiErrorMessage(lookupVehicles.error) ?? "Unable to find vehicles for this invoice. Check the number and try again."}
          </p>
        )}

        <Button
          className="mt-4"
          disabled={!normalizedInvoiceNumber}
          loading={lookupVehicles.isPending}
          onClick={() => void findVehicles()}
        >
          Find vehicle
        </Button>

        {vehicles.length > 0 && (
          <section className="anim-fade-in mt-7" aria-labelledby="invoice-vehicle-title">
            <h2 id="invoice-vehicle-title" className="text-title-2 text-text">Choose the vehicle</h2>
            <p className="text-footnote mt-1 mb-3 text-text-3">Select the vehicle you are about to inspect.</p>

            <div className="space-y-3">
              {vehicles.map((vehicle) => {
                const selected = selectedVehicleId === vehicle.id;

                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    className={`card pressable flex min-h-20 w-full items-center gap-3 border p-4 text-left ${
                      selected ? "border-accent bg-accent-soft" : "border-border"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        selected ? "bg-accent text-white" : "bg-fill text-text-4"
                      }`}
                    >
                      {selected ? <CheckCircle2 size={21} /> : <span className="h-4 w-4 rounded-full border-2 border-current" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-body block font-semibold text-text">{vehicle.name}</span>
                      <span className="text-footnote mt-0.5 block text-text-3">{vehicle.identifier}</span>
                      <span className="text-caption mt-1 block text-text-4">
                        {vehicle.source === "INVOICE" ? "Vehicle on this booking" : "Primary assigned vehicle"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {selectedVehicle && (
          <div className="anim-fade-in mt-5 rounded-xl bg-success-soft p-4 text-success-text">
            <p className="text-body font-semibold">Vehicle selected</p>
            <p className="text-footnote mt-1">Proceed to the Pre Ride Pilot Report for {selectedVehicle.identifier}.</p>
          </div>
        )}

        <div className="mt-auto pt-6">
          {todayChecklistQuery.isError && (
            <p role="alert" className="text-footnote mb-3 text-danger">
              Unable to verify today&apos;s report status. Check your connection and try again.
            </p>
          )}
          {todayState && todayState !== "NOT_STARTED" && (
            <p role="alert" className="text-footnote mb-3 text-danger">
              Today&apos;s Pilot Report has already started. Return Home to resume it.
            </p>
          )}
          <Button
            disabled={!canStartReport}
            loading={currentUserQuery.isLoading || todayChecklistQuery.isLoading}
            onClick={startReport}
          >
            Start Pre Ride Pilot Report
          </Button>
        </div>
      </div>
    </Screen>
  );
}
