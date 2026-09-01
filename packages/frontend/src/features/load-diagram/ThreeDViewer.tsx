/* eslint-disable react/no-unknown-property -- react-three-fiber intrinsics (mesh, boxGeometry, meshStandardMaterial, lights) use props that eslint-plugin-react does not recognize as DOM attributes. */
// ─── 3D Interactive Viewer ───────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Renders the loaded trailer in 3D using @react-three/fiber. The trailer is a
// wireframe box; items are colored meshes positioned by their canonical
// placement. Orbit controls allow rotation/zoom; clicking an item highlights it
// and shows its details (formatted in the selected unit system).
//
// Geometry is scaled by 1/1000 so canonical millimeters map to scene meters,
// keeping the camera/orbit distances reasonable.
// _Requirements: 4.7_

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { loadDiagram } from '@ptv-discovery-coach/shared';
import { useLoadDiagramStore } from './load-diagram-store';
import { getPlan } from './api';
import { extents, stopColor } from './diagram-geometry';

type PlacedItem = loadDiagram.PlacedItem;
type LoadPlan = loadDiagram.LoadPlan;
type TrailerProfile = loadDiagram.TrailerProfile;

const { formatLength, formatWeight } = loadDiagram;

// Scene scale: mm -> meters.
const S = 1 / 1000;

function TrailerWireframe({ trailer }: { trailer: TrailerProfile }) {
  const L = trailer.internalLength * S;
  const W = trailer.internalWidth * S;
  const H = trailer.internalHeight * S;
  // Centered so the trailer sits around the origin.
  return (
    <mesh position={[L / 2, H / 2, W / 2]}>
      <boxGeometry args={[L, H, W]} />
      <meshBasicMaterial color="#2d3748" wireframe />
    </mesh>
  );
}

function ItemMesh({
  item,
  selected,
  onSelect,
}: {
  item: PlacedItem;
  selected: boolean;
  onSelect: (item: PlacedItem) => void;
}) {
  const { dx, dy, dz } = extents(item);
  // World axes: X = length, Y = height (Z canonical), Z = width (Y canonical).
  const w = dx * S;
  const h = dz * S;
  const d = dy * S;
  const cx = (item.placedX + dx / 2) * S;
  const cy = (item.placedZ + dz / 2) * S;
  const cz = (item.placedY + dy / 2) * S;

  return (
    <mesh
      position={[cx, cy, cz]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item);
      }}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={stopColor(item.deliveryStop)}
        transparent
        opacity={selected ? 1 : 0.85}
        emissive={selected ? '#ffffff' : '#000000'}
        emissiveIntensity={selected ? 0.35 : 0}
      />
    </mesh>
  );
}

export function ThreeDViewer() {
  const { planId, displayUnitSystem } = useLoadDiagramStore();
  const [plan, setPlan] = useState<(LoadPlan & { items: PlacedItem[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlacedItem | null>(null);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlan(planId)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const cameraTarget = useMemo<[number, number, number]>(() => {
    if (!plan) return [0, 0, 0];
    const t = plan.trailerProfile;
    return [(t.internalLength * S) / 2, (t.internalHeight * S) / 2, (t.internalWidth * S) / 2];
  }, [plan]);

  if (!planId) return <p className="text-sm text-gray-500">No plan computed yet.</p>;
  if (loading) return <p className="text-sm text-gray-500">Loading 3D view…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!plan) return null;

  const t = plan.trailerProfile;
  const camDist = (t.internalLength * S) * 1.3;

  return (
    <div className="space-y-3">
      <div className="h-[360px] overflow-hidden rounded-md border border-gray-200 bg-gray-900">
        <Canvas camera={{ position: [camDist, camDist * 0.8, camDist], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <group onPointerMissed={() => setSelected(null)}>
            <TrailerWireframe trailer={t} />
            {plan.items.map((it) => (
              <ItemMesh
                key={it.id}
                item={it}
                selected={selected?.id === it.id}
                onSelect={setSelected}
              />
            ))}
          </group>
          <OrbitControls target={cameraTarget} />
        </Canvas>
      </div>

      {selected ? (
        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
          <div className="font-medium text-gray-900">
            #{selected.loadSequence} · {selected.itemId}
          </div>
          <div className="text-gray-600">
            {formatLength(extents(selected).dx, displayUnitSystem)} ·{' '}
            {formatLength(extents(selected).dy, displayUnitSystem)} ·{' '}
            {formatLength(extents(selected).dz, displayUnitSystem)} ·{' '}
            {formatWeight(selected.weight, displayUnitSystem)}
            {selected.deliveryStop != null ? ` · Stop ${selected.deliveryStop}` : ''}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">Drag to orbit · scroll to zoom · click an item for details.</p>
      )}
    </div>
  );
}
