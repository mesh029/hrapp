'use client';

import { ReactFlowProvider } from 'reactflow';
import { ReactNode } from 'react';

interface FlowWrapperProps {
  children: ReactNode;
}

export default function FlowWrapper({ children }: FlowWrapperProps) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}
