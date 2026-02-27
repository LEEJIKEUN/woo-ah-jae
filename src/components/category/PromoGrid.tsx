import { PromoItem } from "@/lib/category-data";
import PromoCard from "@/components/category/PromoCard";

type Props = {
  items: PromoItem[];
};

export default function PromoGrid({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        조건에 맞는 모집글이 아직 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <PromoCard key={item.id} item={item} />
      ))}
    </div>
  );
}
