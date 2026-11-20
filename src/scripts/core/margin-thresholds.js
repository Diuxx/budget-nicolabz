export const DEFAULT_MARGIN_THRESHOLDS={warning:50,positive:100};
export const marginThresholds=data=>data.marginThresholds??DEFAULT_MARGIN_THRESHOLDS;
export function marginStatus(value,data){
  const thresholds=marginThresholds(data);
  if(value<0)return 'negative';
  if(value>=thresholds.positive)return 'positive';
  if(value<=thresholds.warning)return 'warning';
  return 'neutral';
}
