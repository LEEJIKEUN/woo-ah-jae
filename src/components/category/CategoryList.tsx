import { PromoItem } from "@/lib/category-data";
import CategoryListItem from "@/components/category/CategoryListItem";

type Props = {
  items: PromoItem[];
};

export default function CategoryList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-600 bg-[color:var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
        조건에 맞는 공지가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]">
      <ul>
        {items.map((item) => (
          <CategoryListItem key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}
