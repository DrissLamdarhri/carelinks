/**
 * ReviewsList — public list of ratings for a professional.
 */
import { useEffect, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Review { id: string; stars: number; comment: string | null; created_at: string; patient_name: string | null; }

export function ReviewsList({ professionalId }: { professionalId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ratings")
        .select("id, stars, comment, created_at, profiles!ratings_patient_id_fkey(full_name)")
        .eq("professional_id", professionalId)
        .order("created_at", { ascending: false })
        .limit(20);
      setReviews((data ?? []).map((r: any) => ({
        id: r.id, stars: r.stars, comment: r.comment, created_at: r.created_at,
        patient_name: r.profiles?.full_name ?? null,
      })));
      setLoading(false);
    })();
  }, [professionalId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#0D0870]" /></div>;
  if (!reviews.length) return <p className="text-[12px] text-[#888780] text-center py-4">Aucun avis pour l'instant</p>;

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl p-3.5 border border-[#EDE5CC]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[13px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>{r.patient_name ?? "Patient"}</p>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={12} fill={n <= r.stars ? "#F5B544" : "transparent"} stroke={n <= r.stars ? "#F5B544" : "#D0D0D0"} />
              ))}
            </div>
          </div>
          {r.comment && <p className="text-[12px] text-[#666] leading-relaxed">{r.comment}</p>}
          <p className="text-[10px] text-[#888780] mt-1.5">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
        </div>
      ))}
    </div>
  );
}
