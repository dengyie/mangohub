import { memo } from "react";
import { resolveFlagCode } from "@/utils/flag";

interface FlagProps {
  flag: string;
  size?: string;
}

const Flag = memo(({ flag, size }: FlagProps) => {
  const code = resolveFlagCode(flag);
  const requested = Number(size);
  const width = Number.isFinite(requested) && requested > 0 ? requested * 4 : 30;
  return <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-border bg-background" style={{ width, height: width * 2 / 3 }}>
    <img src={`/assets/flags/${code}.svg`} alt={code} width={width} height={width * 2 / 3} className="block h-full w-full object-contain" onError={(event) => {
      if (event.currentTarget.getAttribute("src") !== "/assets/flags/UN.svg") event.currentTarget.src = "/assets/flags/UN.svg";
    }} />
  </span>;
});
Flag.displayName = "Flag";
export default Flag;
