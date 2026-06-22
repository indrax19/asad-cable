import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AdvertisementDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

export function AdvertisementModal() {
  const [ads, setAds] = useState<AdvertisementDoc[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const isMounted = useRef(true);
  const hasShown = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    const unsub = onSnapshot(
      query(collection(db, "advertisements"), where("status", "==", "active")),
      (snap) => {
        if (!isMounted.current) return;
        const activeAds = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdvertisementDoc, "id">),
        }));
        setAds(activeAds);
        if (activeAds.length > 0 && !hasShown.current) {
          hasShown.current = true;
          setOpen(true);
        }
      },
    );
    return () => {
      isMounted.current = false;
      unsub();
    };
  }, []);

  if (ads.length === 0) return null;

  const currentAd = ads[currentAdIndex];

  const handleNext = () => {
    if (currentAdIndex < ads.length - 1) {
      setCurrentAdIndex(currentAdIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentAdIndex > 0) {
      setCurrentAdIndex(currentAdIndex - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 bg-transparent border-0 shadow-none">
        <DialogTitle className="sr-only">Advertisement</DialogTitle>
        <div className="relative">
          {currentAd.link ? (
            <a href={currentAd.link} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={currentAd.imageUrl}
                alt={currentAd.title ?? "Advertisement"}
                className="w-full rounded-lg"
              />
            </a>
          ) : (
            <img
              src={currentAd.imageUrl}
              alt={currentAd.title ?? "Advertisement"}
              className="w-full rounded-lg"
            />
          )}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors shadow-lg"
          >
            <X className="size-5" />
          </button>

          {ads.length > 1 && (
            <>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {ads.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentAdIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentAdIndex ? "bg-white w-6" : "bg-white/50 w-2"
                    }`}
                  />
                ))}
              </div>
              {currentAdIndex > 0 && (
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}
              {currentAdIndex < ads.length - 1 && (
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
