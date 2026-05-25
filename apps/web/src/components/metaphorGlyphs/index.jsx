import { useMemo } from 'react';
import { Billboard, Line, Text } from '@react-three/drei';

function pickColors(theme) {
  return {
    body: theme.componentChipColor ?? theme.slabColor ?? '#94a3b8',
    trim: theme.slabTrimColor ?? theme.spireColor ?? '#cbd5e1',
    accent: theme.binaryGlowColor ?? theme.starColor ?? '#fef08a',
    line: theme.linkColor ?? '#64748b',
    label: theme.labelColor ?? '#0f172a'
  };
}

export function DatabaseGlyph({ size, theme }) {
  const c = pickColors(theme);
  const r = 0.22 * size;
  const h = 0.1 * size;
  const gap = 0.04 * size;
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, i * (h + gap) - h, 0]}>
          <mesh>
            <cylinderGeometry args={[r, r, h, 20]} />
            <meshStandardMaterial color={c.body} />
          </mesh>
          <mesh position={[0, h / 2 + 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.018 * size, 8, 24]} />
            <meshStandardMaterial color={c.trim} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CacheGlyph({ size, theme }) {
  const c = pickColors(theme);
  const r = 0.22 * size;
  const h = 0.13 * size;
  return (
    <group>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, i * (h + 0.04 * size) - h * 0.5, 0]}>
          <cylinderGeometry args={[r, r, h, 20]} />
          <meshStandardMaterial color={c.body} />
        </mesh>
      ))}
      <Line
        points={[
          [-0.04 * size, 0.22 * size, 0.23 * size],
          [0.04 * size, 0.06 * size, 0.23 * size],
          [-0.02 * size, 0.0 * size, 0.23 * size],
          [0.06 * size, -0.22 * size, 0.23 * size]
        ]}
        color={c.accent}
        lineWidth={2.2}
      />
    </group>
  );
}

export function QueueGlyph({ size, theme }) {
  const c = pickColors(theme);
  const w = 0.13 * size;
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[(i - 1.5) * (w + 0.03 * size), 0, 0]}>
          <boxGeometry args={[w, w, w]} />
          <meshStandardMaterial color={i === 3 ? c.accent : c.body} />
        </mesh>
      ))}
    </group>
  );
}

export function FilestoreGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh position={[-0.12 * size, 0.18 * size, 0]}>
        <boxGeometry args={[0.18 * size, 0.06 * size, 0.04 * size]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.5 * size, 0.34 * size, 0.06 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
    </group>
  );
}

export function DatalakeGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.3 * size, 0.3 * size, 0.06 * size, 32]} />
        <meshStandardMaterial color={c.accent} />
      </mesh>
      {[0.16, 0.23, 0.3].map((r, i) => (
        <mesh key={i} position={[0, 0.04 * size + i * 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r * size, 0.012 * size, 6, 28]} />
          <meshStandardMaterial color={c.trim} />
        </mesh>
      ))}
    </group>
  );
}

export function ServiceGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.36 * size, 0.36 * size, 0.36 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.27 * size, 0.04 * size, 8, 24]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

export function ComputeGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.42 * size, 0.4 * size, 0.16 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      {[0.1, 0, -0.1].map((y, i) => (
        <mesh key={i} position={[0, y * size, 0.085 * size]}>
          <boxGeometry args={[0.34 * size, 0.04 * size, 0.02 * size]} />
          <meshStandardMaterial color={c.trim} emissive={c.accent} emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function ContainerGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh position={[0, -0.04 * size, 0]}>
        <boxGeometry args={[0.42 * size, 0.28 * size, 0.3 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0, 0.14 * size, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08 * size, 0.018 * size, 8, 20]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
    </group>
  );
}

export function FunctionGlyph({ size, theme }) {
  const c = pickColors(theme);
  const arc = useMemo(() => {
    const pts = [];
    const segments = 18;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const a = -Math.PI * 0.6 + t * Math.PI * 1.2;
      pts.push([Math.cos(a) * 0.22 * size, Math.sin(a) * 0.22 * size, 0]);
    }
    return pts;
  }, [size]);
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.24 * size, 0.24 * size, 0.08 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <Line points={arc} color={c.accent} lineWidth={2.4} />
    </group>
  );
}

export function ModelGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <mesh>
      <icosahedronGeometry args={[0.28 * size, 1]} />
      <meshStandardMaterial color={c.body} emissive={c.accent} emissiveIntensity={0.18} />
    </mesh>
  );
}

export function GatewayGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh position={[-0.18 * size, 0, 0]}>
        <boxGeometry args={[0.08 * size, 0.36 * size, 0.08 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0.18 * size, 0, 0]}>
        <boxGeometry args={[0.08 * size, 0.36 * size, 0.08 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0, 0.18 * size, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18 * size, 0.04 * size, 8, 16, Math.PI]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
    </group>
  );
}

export function NetworkGlyph({ size, theme }) {
  const c = pickColors(theme);
  const satellites = [
    [0.3, 0.2, 0],
    [-0.3, 0.2, 0],
    [0.3, -0.2, 0],
    [-0.3, -0.2, 0]
  ];
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.12 * size, 16, 16]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.3} />
      </mesh>
      {satellites.map((pos, i) => (
        <group key={i}>
          <mesh position={[pos[0] * size, pos[1] * size, pos[2] * size]}>
            <sphereGeometry args={[0.06 * size, 12, 12]} />
            <meshStandardMaterial color={c.body} />
          </mesh>
          <Line
            points={[[0, 0, 0], [pos[0] * size, pos[1] * size, pos[2] * size]]}
            color={c.line}
            lineWidth={1.4}
            transparent
            opacity={0.7}
          />
        </group>
      ))}
    </group>
  );
}

export function CdnGlyph({ size, theme }) {
  const c = pickColors(theme);
  const arms = useMemo(() => {
    const out = [];
    const count = 6;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      out.push([Math.cos(a) * 0.3 * size, Math.sin(a) * 0.3 * size, 0]);
    }
    return out;
  }, [size]);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.12 * size, 16, 16]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.4} />
      </mesh>
      {arms.map((p, i) => (
        <Line
          key={i}
          points={[[0, 0, 0], p]}
          color={c.line}
          lineWidth={1.4}
          transparent
          opacity={0.85}
        />
      ))}
    </group>
  );
}

export function LoadbalancerGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh position={[0, 0.16 * size, 0]}>
        <boxGeometry args={[0.42 * size, 0.08 * size, 0.16 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      {[-0.14, 0, 0.14].map((x, i) => (
        <group key={i}>
          <mesh position={[x * size, 0, 0]}>
            <cylinderGeometry args={[0.018 * size, 0.018 * size, 0.18 * size, 8]} />
            <meshStandardMaterial color={c.trim} />
          </mesh>
          <mesh position={[x * size, -0.14 * size, 0]}>
            <coneGeometry args={[0.05 * size, 0.08 * size, 8]} />
            <meshStandardMaterial color={c.accent} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function SecurityGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh>
        <coneGeometry args={[0.22 * size, 0.4 * size, 5]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0, 0.06 * size, 0.13 * size]}>
        <sphereGeometry args={[0.06 * size, 12, 12]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export function IdentityGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.16 * size, 16, 16]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0, 0.22 * size, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18 * size, 0.018 * size, 6, 28]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

export function FirewallGlyph({ size, theme }) {
  const c = pickColors(theme);
  const rows = useMemo(() => {
    const out = [];
    for (let r = 0; r < 3; r += 1) {
      const offset = r % 2 === 0 ? 0 : 0.08 * size;
      for (let col = 0; col < 3; col += 1) {
        out.push([(col - 1) * 0.16 * size + offset, (r - 1) * 0.1 * size, 0]);
      }
    }
    return out;
  }, [size]);
  return (
    <group>
      {rows.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.14 * size, 0.08 * size, 0.06 * size]} />
          <meshStandardMaterial color={i % 2 === 0 ? c.body : c.trim} />
        </mesh>
      ))}
    </group>
  );
}

export function UserGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh position={[0, 0.16 * size, 0]}>
        <sphereGeometry args={[0.1 * size, 14, 14]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0, -0.05 * size, 0]}>
        <cylinderGeometry args={[0.08 * size, 0.12 * size, 0.22 * size, 14]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
    </group>
  );
}

function MiniUser({ position, theme, color }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.06 * 0.4, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -0.02 * 0.4, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.09, 10]} />
        <meshStandardMaterial color={theme.trim ?? color} />
      </mesh>
    </group>
  );
}

export function TeamGlyph({ size, theme }) {
  const c = pickColors(theme);
  const positions = [
    [0, 0.12 * size, 0],
    [-0.14 * size, -0.08 * size, 0],
    [0.14 * size, -0.08 * size, 0]
  ];
  return (
    <group>
      {positions.map((p, i) => (
        <MiniUser key={i} position={p} theme={{ trim: c.trim }} color={c.body} />
      ))}
    </group>
  );
}

export function AgentGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh position={[0, 0.14 * size, 0]}>
        <sphereGeometry args={[0.12 * size, 14, 14]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0, -0.06 * size, 0]}>
        <cylinderGeometry args={[0.08 * size, 0.12 * size, 0.22 * size, 14]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
      <mesh position={[0, 0.32 * size, 0]}>
        <cylinderGeometry args={[0.012 * size, 0.012 * size, 0.16 * size, 6]} />
        <meshStandardMaterial color={c.accent} />
      </mesh>
      <mesh position={[0, 0.42 * size, 0]}>
        <sphereGeometry args={[0.03 * size, 10, 10]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

export function EventGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.08 * size, 14, 14]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.5} />
      </mesh>
      {[0.16, 0.24, 0.32].map((r, i) => (
        <mesh key={i}>
          <torusGeometry args={[r * size, 0.012 * size, 6, 28]} />
          <meshStandardMaterial
            color={c.accent}
            emissive={c.accent}
            emissiveIntensity={0.4 - i * 0.1}
            transparent
            opacity={0.6 - i * 0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

export function ChannelGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <mesh>
      <cylinderGeometry args={[0.22 * size, 0.05 * size, 0.4 * size, 18]} />
      <meshStandardMaterial color={c.body} />
    </mesh>
  );
}

export function SignalGlyph({ size, theme }) {
  const c = pickColors(theme);
  const arcs = useMemo(() => {
    const result = [];
    for (let k = 1; k <= 3; k += 1) {
      const radius = 0.1 * k * size;
      const segments = 18;
      const pts = [];
      for (let i = 0; i <= segments; i += 1) {
        const a = -Math.PI * 0.45 + (i / segments) * Math.PI * 0.9;
        pts.push([Math.sin(a) * radius, -0.18 * size + Math.cos(a) * radius, 0]);
      }
      result.push(pts);
    }
    return result;
  }, [size]);
  return (
    <group>
      <mesh position={[0, -0.18 * size, 0]}>
        <sphereGeometry args={[0.05 * size, 12, 12]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.5} />
      </mesh>
      {arcs.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={c.accent}
          lineWidth={1.8}
          transparent
          opacity={0.85 - i * 0.2}
        />
      ))}
    </group>
  );
}

export function DocumentGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.3 * size, 0.42 * size, 0.04 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0.1 * size, 0.16 * size, 0.03 * size]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.08 * size, 0.08 * size, 0.04 * size]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
    </group>
  );
}

export function MoneyGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24 * size, 0.24 * size, 0.06 * size, 24]} />
        <meshStandardMaterial
          color={c.accent}
          emissive={c.accent}
          emissiveIntensity={0.25}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      <Billboard position={[0, 0, 0.04 * size]}>
        <Text
          fontSize={0.3 * size}
          color={c.label}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012 * size}
          outlineColor={c.accent}
        >
          $
        </Text>
      </Billboard>
    </group>
  );
}

export function TimeGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22 * size, 0.03 * size, 10, 32]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <Line
        points={[
          [0, 0, 0.01 * size],
          [0, 0.16 * size, 0.01 * size]
        ]}
        color={c.accent}
        lineWidth={2.6}
      />
      <Line
        points={[
          [0, 0, 0.01 * size],
          [0.12 * size, 0, 0.01 * size]
        ]}
        color={c.accent}
        lineWidth={2.2}
      />
    </group>
  );
}

export function DecisionGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <mesh rotation={[0, 0, Math.PI / 4]}>
      <boxGeometry args={[0.32 * size, 0.32 * size, 0.1 * size]} />
      <meshStandardMaterial color={c.body} />
    </mesh>
  );
}

export function MetricGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.08 * size, 0.38 * size, 0.08 * size]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh position={[0, 0.26 * size, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.09 * size, 0.14 * size, 4]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export function AnchorGlyph({ size, theme }) {
  const c = pickColors(theme);
  const arcLeft = useMemo(() => {
    const pts = [];
    const segments = 14;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const a = -Math.PI * 0.5 - t * Math.PI * 0.6;
      pts.push([Math.cos(a) * 0.16 * size, -0.18 * size + Math.sin(a) * 0.16 * size, 0]);
    }
    return pts;
  }, [size]);
  const arcRight = useMemo(() => arcLeft.map(([x, y, z]) => [-x, y, z]), [arcLeft]);
  return (
    <group>
      <mesh position={[0, 0.18 * size, 0]}>
        <torusGeometry args={[0.06 * size, 0.018 * size, 6, 20]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.025 * size, 0.025 * size, 0.4 * size, 10]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <Line points={arcLeft} color={c.body} lineWidth={2.4} />
      <Line points={arcRight} color={c.body} lineWidth={2.4} />
    </group>
  );
}

export function TargetGlyph({ size, theme }) {
  const c = pickColors(theme);
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry args={[0.28 * size, 0.03 * size, 8, 32]} />
        <meshStandardMaterial color={c.body} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.18 * size, 0.03 * size, 8, 32]} />
        <meshStandardMaterial color={c.trim} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.08 * size, 0.03 * size, 8, 24]} />
        <meshStandardMaterial color={c.accent} emissive={c.accent} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

const REGISTRY = {
  database: DatabaseGlyph,
  cache: CacheGlyph,
  queue: QueueGlyph,
  filestore: FilestoreGlyph,
  datalake: DatalakeGlyph,
  service: ServiceGlyph,
  compute: ComputeGlyph,
  container: ContainerGlyph,
  function: FunctionGlyph,
  model: ModelGlyph,
  gateway: GatewayGlyph,
  network: NetworkGlyph,
  cdn: CdnGlyph,
  loadbalancer: LoadbalancerGlyph,
  security: SecurityGlyph,
  identity: IdentityGlyph,
  firewall: FirewallGlyph,
  user: UserGlyph,
  team: TeamGlyph,
  agent: AgentGlyph,
  event: EventGlyph,
  channel: ChannelGlyph,
  signal: SignalGlyph,
  document: DocumentGlyph,
  money: MoneyGlyph,
  time: TimeGlyph,
  decision: DecisionGlyph,
  metric: MetricGlyph,
  anchor: AnchorGlyph,
  target: TargetGlyph
};

export function Glyph({ kind, size = 1, theme }) {
  if (!kind) return null;
  const Component = REGISTRY[kind];
  if (!Component) return null;
  return <Component size={size} theme={theme} />;
}
