'use client';

import {
  Ambulance,
  Check,
  HardHat,
  Megaphone,
  PhoneCall,
  Send,
  ShieldAlert,
  ShipWheel,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  actionCatalog,
  type ActionId,
  type IncidentSnapshot,
} from '@/lib/incidents';

type ActionStatuses = Partial<Record<ActionId, 'dispatched'>>;

export function ResponseActions({
  incident,
  statuses,
  onDispatch,
}: {
  incident: IncidentSnapshot;
  statuses: ActionStatuses;
  onDispatch: (actionId: ActionId) => void;
}) {
  const [pendingAction, setPendingAction] = useState<ActionId | null>(null);
  const pending = pendingAction ? actionCatalog[pendingAction] : null;

  return (
    <section className="rounded-md border border-[#dd644c]/22 bg-[#151817] p-3">
      <div className="flex items-center gap-2">
        <Send className="size-4 text-[#e3836e]" aria-hidden="true" />
        <h3 className="text-xs font-semibold">Recommended follow-up actions</h3>
        <Badge className="ml-auto border-[#e3836e]/20 bg-[#e3836e]/8 text-[8px] text-[#df927f]">
          HUMAN AUTHORIZATION
        </Badge>
      </div>
      <div className="mt-3 space-y-2">
        {incident.recommendedActionIds.map((actionId) => {
          const action = actionCatalog[actionId];
          const dispatched = statuses[actionId] === 'dispatched';
          const Icon = actionIcon(actionId);

          return (
            <div
              key={actionId}
              className="rounded-md border border-white/8 bg-[#0d1416] p-2.5"
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${
                    dispatched
                      ? 'bg-[#4dbb91]/12 text-[#78d0ae]'
                      : 'bg-[#d79b39]/10 text-[#dfad59]'
                  }`}
                >
                  {dispatched ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Icon className="size-3.5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-[#d7e0dd]">
                    {action.title}
                  </p>
                  <p className="mt-0.5 text-[9px] text-[#71827e]">
                    {action.team}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={dispatched}
                onClick={() => setPendingAction(actionId)}
                className={`mt-2 h-7 w-full text-[10px] ${
                  dispatched
                    ? 'border-[#4dbb91]/18 bg-[#4dbb91]/7 text-[#78d0ae]'
                    : 'border-white/10 bg-white/[0.025] text-[#aebdb9]'
                }`}
              >
                {dispatched ? (
                  <>
                    <Check className="size-3" aria-hidden="true" />
                    Simulated dispatch sent
                  </>
                ) : (
                  <>
                    <Send className="size-3" aria-hidden="true" />
                    Review and authorize
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent className="border border-white/10 bg-[#12191b] text-[#edf2f0]">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[#d79b39]/12 text-[#e4ae53]">
              <ShieldAlert aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Authorize simulated action?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8fa09c]">
              {pending?.title} — {pending?.description} This demo records the
              authorization locally; it does not contact a real agency.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-white/8 bg-white/[0.025]">
            <AlertDialogCancel onClick={() => setPendingAction(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAction) onDispatch(pendingAction);
                setPendingAction(null);
              }}
              className="bg-[#d79b39] text-[#1d160b] hover:bg-[#e9ae4c]"
            >
              Authorize simulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function actionIcon(actionId: ActionId) {
  switch (actionId) {
    case 'notify_disaster_command':
      return PhoneCall;
    case 'dispatch_rescue_canoes':
      return ShipWheel;
    case 'dispatch_medical_team':
      return Ambulance;
    case 'close_access_route':
      return ShieldAlert;
    case 'evacuate_area':
      return Users;
    case 'dispatch_technical_team':
      return HardHat;
    case 'request_utility_shutdown':
      return Zap;
    case 'issue_public_alert':
      return Megaphone;
  }
}
