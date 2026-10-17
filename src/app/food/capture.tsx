// CONTRACT: CMP-FOOD-002 (A3)
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FoodCaptureScreen } from '@/modules/food';

export default function FoodCaptureRoute(): React.JSX.Element {
  const { mealCategoryId } = useLocalSearchParams<{ mealCategoryId?: string }>();
  return <FoodCaptureScreen mealCategoryId={mealCategoryId ?? null} />;
}
