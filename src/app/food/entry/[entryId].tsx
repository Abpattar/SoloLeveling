// CONTRACT: CMP-FOOD-003 (A3)
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FoodEntryScreen } from '@/modules/food';

export default function FoodEntryRoute(): React.JSX.Element {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <FoodEntryScreen entryId={entryId} />;
}
