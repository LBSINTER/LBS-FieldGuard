/**
 * LBS FieldGuard — Icon wrapper
 *
 * Thin wrapper around react-native-vector-icons/MaterialCommunityIcons.
 * Provides a type-safe name prop instead of string.
 */

import React from 'react';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props {
  name: string;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 24, color = '#e6edf3' }: Props) {
  return <MCIcon name={name} size={size} color={color} />;
}
