/* =============================================================================
   Shared code for index.html and ha-index.html.
   Loaded as a CLASSIC script (no module/import) so it works over file:// too.
   Contains: JFrog reference data, tier helpers, and fmtGB().
   Each page keeps its own calculate()/render().
   ============================================================================= */

/* =========================================================================
   JFrog reference architecture data — verbatim from published JFrog tables.
   Sources:
     - jfrog.com/reference-architecture/self-managed/deployment/sizing/{aws,azure,gcp}/
     - jfrog.com/reference-architecture/self-managed/deployment/sizing/storage/
     - docs.jfrog.com/installation/docs/hardware-sizing-matrix
   ========================================================================= */

const TIER_ORDER = ["small", "medium", "large", "xlarge", "2xlarge"];
const TIER_LABEL = { small:"Small", medium:"Medium", large:"Large", xlarge:"XLarge", "2xlarge":"2XLarge" };

// Tier classification from RPM + concurrent connection caps (reference architecture).
const TIER_RPM = {
  small:     { maxRpm: 6000,   maxConns: 100  },
  medium:    { maxRpm: 50000,  maxConns: 500  },
  large:     { maxRpm: 100000, maxConns: 1200 },
  xlarge:    { maxRpm: 200000, maxConns: 3000 },
  "2xlarge": { maxRpm: 500000, maxConns: 6000 }
};

// Map active clients → suggested tier using the hardware sizing matrix breakpoints.
function tierFromClients(c) {
  if (c <= 20)  return "small";
  if (c <= 100) return "medium";
  if (c <= 200) return "large";
  return "2xlarge"; // contact support beyond
}
function tierFromRpm(rpm) {
  if (rpm <= 6000)   return "small";
  if (rpm <= 50000)  return "medium";
  if (rpm <= 100000) return "large";
  if (rpm <= 200000) return "xlarge";
  return "2xlarge";
}
function maxTier(a, b) {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

// Replicas per tier per component (reference architecture, identical across clouds).
const REPLICAS = {
  artifactory: { small:1, medium:2, large:3, xlarge:4, "2xlarge":6 },
  nginx:       { small:1, medium:2, large:2, xlarge:2, "2xlarge":3 },
  xray:        { small:1, medium:2, large:2, xlarge:2, "2xlarge":3 },
  rabbitmq:    { small:1, medium:3, large:3, xlarge:3, "2xlarge":3 },
  jas:         { small:1, medium:1, large:1, xlarge:1, "2xlarge":1 }
};

// JFrog-published instance types per cloud per tier per component.
const REF_ARCH = {
  aws: {
    artifactory: {
      small:     { instance:"m8g.2xlarge", cpu:8,  memGB:32 },
      medium:    { instance:"m8g.2xlarge", cpu:8,  memGB:32 },
      large:     { instance:"m8g.4xlarge", cpu:16, memGB:64 },
      xlarge:    { instance:"m8g.4xlarge", cpu:16, memGB:64 },
      "2xlarge": { instance:"m8g.4xlarge", cpu:16, memGB:64 }
    },
    nginx: {
      small:     { instance:"c8g.xlarge",  cpu:4, memGB:8  },
      medium:    { instance:"c8g.xlarge",  cpu:4, memGB:8  },
      large:     { instance:"c8g.xlarge",  cpu:4, memGB:8  },
      xlarge:    { instance:"c8g.2xlarge", cpu:8, memGB:16 },
      "2xlarge": { instance:"c8g.2xlarge", cpu:8, memGB:16 }
    },
    xray: {
      small:     { instance:"c8g.2xlarge", cpu:8, memGB:16 },
      medium:    { instance:"m8g.2xlarge", cpu:8, memGB:32 },
      large:     { instance:"m8g.2xlarge", cpu:8, memGB:32 },
      xlarge:    { instance:"m8g.2xlarge", cpu:8, memGB:32 },
      "2xlarge": { instance:"m8g.2xlarge", cpu:8, memGB:32 }
    },
    rabbitmq: {
      small:     { instance:"c8g.xlarge", cpu:4, memGB:8 },
      medium:    { instance:"c8g.xlarge", cpu:4, memGB:8 },
      large:     { instance:"c8g.xlarge", cpu:4, memGB:8 },
      xlarge:    { instance:"c8g.xlarge", cpu:4, memGB:8 },
      "2xlarge": { instance:"c8g.xlarge", cpu:4, memGB:8 }
    },
    jas: {
      small:     { instance:"m8g.2xlarge", cpu:8, memGB:32 },
      medium:    { instance:"m8g.2xlarge", cpu:8, memGB:32 },
      large:     { instance:"m8g.2xlarge", cpu:8, memGB:32 },
      xlarge:    { instance:"m8g.2xlarge", cpu:8, memGB:32 },
      "2xlarge": { instance:"m8g.2xlarge", cpu:8, memGB:32 }
    },
    artifactoryDb: {
      small:     { instance:"db.m8g.2xlarge",  cpu:8,  memGB:32,  maxConns:100  },
      medium:    { instance:"db.m8g.4xlarge",  cpu:16, memGB:64,  maxConns:200  },
      large:     { instance:"db.m8g.8xlarge",  cpu:32, memGB:128, maxConns:600  },
      xlarge:    { instance:"db.m8g.12xlarge", cpu:48, memGB:192, maxConns:2000 },
      "2xlarge": { instance:"db.m8g.16xlarge", cpu:64, memGB:256, maxConns:5000 }
    },
    xrayDb: {
      small:     { instance:"db.m8g.xlarge",   cpu:4,  memGB:16,  maxConns:200  },
      medium:    { instance:"db.m8g.2xlarge",  cpu:8,  memGB:32,  maxConns:500  },
      large:     { instance:"db.m8g.4xlarge",  cpu:16, memGB:64,  maxConns:600  },
      xlarge:    { instance:"db.m8g.8xlarge",  cpu:32, memGB:128, maxConns:1200 },
      "2xlarge": { instance:"db.m8g.12xlarge", cpu:48, memGB:192, maxConns:2000 }
    }
  },
  azure: {
    artifactory: {
      small:     { instance:"Standard_D8s_v6",  cpu:8,  memGB:32 },
      medium:    { instance:"Standard_D8s_v6",  cpu:8,  memGB:32 },
      large:     { instance:"Standard_D16s_v6", cpu:16, memGB:64 },
      xlarge:    { instance:"Standard_D16s_v6", cpu:16, memGB:64 },
      "2xlarge": { instance:"Standard_D16s_v6", cpu:16, memGB:64 }
    },
    nginx: {
      small:     { instance:"Standard_F4s_v2", cpu:4, memGB:8  },
      medium:    { instance:"Standard_F4s_v2", cpu:4, memGB:8  },
      large:     { instance:"Standard_F4s_v2", cpu:4, memGB:8  },
      xlarge:    { instance:"Standard_F8s_v2", cpu:8, memGB:16 },
      "2xlarge": { instance:"Standard_F8s_v2", cpu:8, memGB:16 }
    },
    xray: {
      small:     { instance:"Standard_F8s_v2", cpu:8, memGB:16 },
      medium:    { instance:"Standard_D8s_v6", cpu:8, memGB:32 },
      large:     { instance:"Standard_D8s_v6", cpu:8, memGB:32 },
      xlarge:    { instance:"Standard_D8s_v6", cpu:8, memGB:32 },
      "2xlarge": { instance:"Standard_D8s_v6", cpu:8, memGB:32 }
    },
    rabbitmq: {
      small:     { instance:"Standard_F4s_v2", cpu:4, memGB:8 },
      medium:    { instance:"Standard_F4s_v2", cpu:4, memGB:8 },
      large:     { instance:"Standard_F4s_v2", cpu:4, memGB:8 },
      xlarge:    { instance:"Standard_F4s_v2", cpu:4, memGB:8 },
      "2xlarge": { instance:"Standard_F4s_v2", cpu:4, memGB:8 }
    },
    jas: {
      small:     { instance:"Standard_D8s_v6", cpu:8, memGB:32 },
      medium:    { instance:"Standard_D8s_v6", cpu:8, memGB:32 },
      large:     { instance:"Standard_D8s_v6", cpu:8, memGB:32 },
      xlarge:    { instance:"Standard_D8s_v6", cpu:8, memGB:32 },
      "2xlarge": { instance:"Standard_D8s_v6", cpu:8, memGB:32 }
    },
    artifactoryDb: {
      small:     { instance:"Standard_E8ds_v6",  cpu:8,  memGB:64,  maxConns:100  },
      medium:    { instance:"Standard_E16ds_v6", cpu:16, memGB:128, maxConns:200  },
      large:     { instance:"Standard_E20ds_v6", cpu:20, memGB:160, maxConns:600  },
      xlarge:    { instance:"Standard_E32ds_v6", cpu:32, memGB:256, maxConns:2000 },
      "2xlarge": { instance:"Standard_E48ds_v6", cpu:48, memGB:384, maxConns:5000 }
    },
    xrayDb: {
      small:     { instance:"Standard_E4ds_v6",  cpu:4,  memGB:32,  maxConns:200  },
      medium:    { instance:"Standard_E8ds_v6",  cpu:8,  memGB:64,  maxConns:500  },
      large:     { instance:"Standard_E16ds_v6", cpu:16, memGB:128, maxConns:600  },
      xlarge:    { instance:"Standard_E32ds_v6", cpu:32, memGB:256, maxConns:1200 },
      "2xlarge": { instance:"Standard_E48ds_v6", cpu:48, memGB:384, maxConns:2000 }
    }
  },
  gcp: {
    artifactory: {
      small:     { instance:"n4-standard-8",  cpu:8,  memGB:32 },
      medium:    { instance:"n4-standard-8",  cpu:8,  memGB:32 },
      large:     { instance:"n4-standard-16", cpu:16, memGB:64 },
      xlarge:    { instance:"n4-standard-16", cpu:16, memGB:64 },
      "2xlarge": { instance:"n4-standard-16", cpu:16, memGB:64 }
    },
    nginx: {
      small:     { instance:"c4d-highcpu-4", cpu:4, memGB:8  },
      medium:    { instance:"c4d-highcpu-4", cpu:4, memGB:8  },
      large:     { instance:"c4d-highcpu-4", cpu:4, memGB:8  },
      xlarge:    { instance:"c4d-highcpu-8", cpu:8, memGB:16 },
      "2xlarge": { instance:"c4d-highcpu-8", cpu:8, memGB:16 }
    },
    xray: {
      small:     { instance:"c4d-highcpu-8", cpu:8, memGB:15 },
      medium:    { instance:"n4-standard-8", cpu:8, memGB:32 },
      large:     { instance:"n4-standard-8", cpu:8, memGB:32 },
      xlarge:    { instance:"n4-standard-8", cpu:8, memGB:32 },
      "2xlarge": { instance:"n4-standard-8", cpu:8, memGB:32 }
    },
    rabbitmq: {
      small:     { instance:"c4d-highcpu-4", cpu:4, memGB:7 },
      medium:    { instance:"c4d-highcpu-4", cpu:4, memGB:7 },
      large:     { instance:"c4d-highcpu-4", cpu:4, memGB:7 },
      xlarge:    { instance:"c4d-highcpu-4", cpu:4, memGB:7 },
      "2xlarge": { instance:"c4d-highcpu-4", cpu:4, memGB:7 }
    },
    jas: {
      small:     { instance:"n4-standard-8", cpu:8, memGB:32 },
      medium:    { instance:"n4-standard-8", cpu:8, memGB:32 },
      large:     { instance:"n4-standard-8", cpu:8, memGB:32 },
      xlarge:    { instance:"n4-standard-8", cpu:8, memGB:32 },
      "2xlarge": { instance:"n4-standard-8", cpu:8, memGB:32 }
    },
    artifactoryDb: {
      small:     { instance:"Cloud SQL 8 vCPU",  cpu:8,  memGB:32,  maxConns:100  },
      medium:    { instance:"Cloud SQL 16 vCPU", cpu:16, memGB:64,  maxConns:200  },
      large:     { instance:"Cloud SQL 32 vCPU", cpu:32, memGB:128, maxConns:600  },
      xlarge:    { instance:"Cloud SQL 48 vCPU", cpu:48, memGB:192, maxConns:2000 },
      "2xlarge": { instance:"Cloud SQL 64 vCPU", cpu:64, memGB:256, maxConns:5000 }
    },
    xrayDb: {
      small:     { instance:"Cloud SQL 4 vCPU",  cpu:4,  memGB:16,  maxConns:200  },
      medium:    { instance:"Cloud SQL 8 vCPU",  cpu:8,  memGB:32,  maxConns:500  },
      large:     { instance:"Cloud SQL 16 vCPU", cpu:16, memGB:64,  maxConns:600  },
      xlarge:    { instance:"Cloud SQL 32 vCPU", cpu:32, memGB:128, maxConns:1200 },
      "2xlarge": { instance:"Cloud SQL 48 vCPU", cpu:48, memGB:192, maxConns:2000 }
    }
  },
  // Onprem mirrors the cloud CPU/RAM as generic VMs (JFrog doesn't publish onprem-specific SKUs).
  onprem: {
    artifactory: {
      small:     { instance:"VM 8 vCPU / 32 GB",  cpu:8,  memGB:32 },
      medium:    { instance:"VM 8 vCPU / 32 GB",  cpu:8,  memGB:32 },
      large:     { instance:"VM 16 vCPU / 64 GB", cpu:16, memGB:64 },
      xlarge:    { instance:"VM 16 vCPU / 64 GB", cpu:16, memGB:64 },
      "2xlarge": { instance:"VM 16 vCPU / 64 GB", cpu:16, memGB:64 }
    },
    nginx: {
      small:     { instance:"VM 4 vCPU / 8 GB",  cpu:4, memGB:8  },
      medium:    { instance:"VM 4 vCPU / 8 GB",  cpu:4, memGB:8  },
      large:     { instance:"VM 4 vCPU / 8 GB",  cpu:4, memGB:8  },
      xlarge:    { instance:"VM 8 vCPU / 16 GB", cpu:8, memGB:16 },
      "2xlarge": { instance:"VM 8 vCPU / 16 GB", cpu:8, memGB:16 }
    },
    xray: {
      small:     { instance:"VM 8 vCPU / 16 GB", cpu:8, memGB:16 },
      medium:    { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 },
      large:     { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 },
      xlarge:    { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 },
      "2xlarge": { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 }
    },
    rabbitmq: {
      small:     { instance:"VM 4 vCPU / 8 GB", cpu:4, memGB:8 },
      medium:    { instance:"VM 4 vCPU / 8 GB", cpu:4, memGB:8 },
      large:     { instance:"VM 4 vCPU / 8 GB", cpu:4, memGB:8 },
      xlarge:    { instance:"VM 4 vCPU / 8 GB", cpu:4, memGB:8 },
      "2xlarge": { instance:"VM 4 vCPU / 8 GB", cpu:4, memGB:8 }
    },
    jas: {
      small:     { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 },
      medium:    { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 },
      large:     { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 },
      xlarge:    { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 },
      "2xlarge": { instance:"VM 8 vCPU / 32 GB", cpu:8, memGB:32 }
    },
    artifactoryDb: {
      small:     { instance:"PostgreSQL VM 8 vCPU / 32 GB",  cpu:8,  memGB:32,  maxConns:100  },
      medium:    { instance:"PostgreSQL VM 16 vCPU / 64 GB", cpu:16, memGB:64,  maxConns:200  },
      large:     { instance:"PostgreSQL VM 32 vCPU / 128 GB",cpu:32, memGB:128, maxConns:600  },
      xlarge:    { instance:"PostgreSQL VM 48 vCPU / 192 GB",cpu:48, memGB:192, maxConns:2000 },
      "2xlarge": { instance:"PostgreSQL VM 64 vCPU / 256 GB",cpu:64, memGB:256, maxConns:5000 }
    },
    xrayDb: {
      small:     { instance:"PostgreSQL VM 4 vCPU / 16 GB",  cpu:4,  memGB:16,  maxConns:200  },
      medium:    { instance:"PostgreSQL VM 8 vCPU / 32 GB",  cpu:8,  memGB:32,  maxConns:500  },
      large:     { instance:"PostgreSQL VM 16 vCPU / 64 GB", cpu:16, memGB:64,  maxConns:600  },
      xlarge:    { instance:"PostgreSQL VM 32 vCPU / 128 GB",cpu:32, memGB:128, maxConns:1200 },
      "2xlarge": { instance:"PostgreSQL VM 48 vCPU / 192 GB",cpu:48, memGB:192, maxConns:2000 }
    }
  }
};

// Per-tier storage (size, IOPS, MB/s) — from the JFrog storage specification page.
const STORAGE = {
  artifactory:   { small:{gb:500, iops:3000, mbps:500 },  medium:{gb:500, iops:3000, mbps:500 },  large:{gb:1000,iops:6000, mbps:1000}, xlarge:{gb:1000,iops:6000, mbps:1000}, "2xlarge":{gb:1000,iops:6000, mbps:1000} },
  xray:          { small:{gb:100, iops:3000, mbps:500 },  medium:{gb:100, iops:3000, mbps:500 },  large:{gb:200, iops:6000, mbps:1000}, xlarge:{gb:200, iops:6000, mbps:1000}, "2xlarge":{gb:200, iops:6000, mbps:1000} },
  rabbitmq:      { small:{gb:100, iops:3000, mbps:500 },  medium:{gb:100, iops:3000, mbps:500 },  large:{gb:100, iops:3000, mbps:500 }, xlarge:{gb:100, iops:3000, mbps:500 }, "2xlarge":{gb:100, iops:3000, mbps:500 } },
  jas:           { small:{gb:300, iops:3000, mbps:500 },  medium:{gb:300, iops:3000, mbps:500 },  large:{gb:300, iops:3000, mbps:500 }, xlarge:{gb:300, iops:3000, mbps:500 }, "2xlarge":{gb:300, iops:3000, mbps:500 } },
  // Artifactory DB disk is "1/3 of filestore" with these IOPS/throughput per tier.
  artifactoryDb: { small:{frac:1/3, iops:4000, mbps:500 },  medium:{frac:1/3, iops:6000, mbps:600 },  large:{frac:1/3, iops:10000, mbps:800}, xlarge:{frac:1/3, iops:12000, mbps:1000}, "2xlarge":{frac:1/3, iops:20000, mbps:1500} },
  xrayDb:        { small:{gb:500, iops:4000, mbps:500 },  medium:{gb:500, iops:6000, mbps:600 },  large:{gb:800, iops:6000, mbps:600}, xlarge:{gb:1000,iops:8000, mbps:1000}, "2xlarge":{gb:2500,iops:12000,mbps:1000} }
};

// Co-location rules — verbatim quotes from JFrog reference architecture pages.
const COLOCATION_RULES = [
  { rule:"Distribution can run on the Artifactory nodes",        relation:"co-locate", components:["Distribution → Artifactory"] },
  { rule:"Each Artifactory replica should run in its own instance (prefer a dedicated node pool)", relation:"dedicated", components:["Artifactory"] },
  { rule:"Each Nginx replica should run in its own instance (prefer a dedicated node pool)",       relation:"dedicated", components:["Nginx"] },
  { rule:"Each Xray replica should run in its own instance (prefer a dedicated node pool)",        relation:"dedicated", components:["Xray"] },
  { rule:"If running JAS, it's recommended to use a dedicated node pool for it to protect Xray and Artifactory pods", relation:"dedicated", components:["JAS"] },
  { rule:"For Xray HA / more than 100K indexed artifacts, RabbitMQ and Xray must run on separate servers (split mode)", relation:"dedicated", components:["RabbitMQ", "Xray"] },
  { rule:"RabbitMQ must be deployed in odd-numbered clusters (1, 3, 5, ...) so quorum queues can elect a majority", relation:"odd-quorum", components:["RabbitMQ"] }
];

const STORAGE_CLASS = {
  aws:    { block:"EBS gp3 (SSD, ≥3000 IOPS)",       premium:"EBS io2 Block Express",  object:"Amazon S3 + lifecycle policies" },
  azure:  { block:"Premium SSD v2",                  premium:"Ultra Disk",             object:"Azure Blob Storage (Hot/Cool tiers)" },
  gcp:    { block:"pd-ssd (≥3000 IOPS)",             premium:"Hyperdisk Extreme",      object:"Google Cloud Storage + Object Lifecycle" },
  onprem: { block:"Enterprise NVMe SSD (≥3K IOPS)",  premium:"All-flash SAN",          object:"S3-compatible (MinIO / Ceph / NetApp StorageGRID)" }
};

const NETWORK_REC = {
  aws:    "≥ 10 Gbps ENA, Placement Group (cluster) for HA replicas, PrivateLink for managed services.",
  azure:  "Accelerated Networking, ≥ 10 Gbps, Availability Zones for HA.",
  gcp:    "Tier-1 networking (up to 32 Gbps), regional MIG, Cloud NAT for egress.",
  onprem: "≥ 10 GbE bonded NICs, low-latency switching, redundant L3 paths between nodes."
};

const K8S_NOTES = {
  aws:    "EKS — Karpenter or Cluster Autoscaler; storageClass <code>gp3</code> via ebs.csi.aws.com; NLB for ingress.",
  azure:  "AKS — Premium SSD CSI (disk.csi.azure.com); Standard SKU LB; Application Gateway Ingress.",
  gcp:    "GKE (Standard or Autopilot) — pd-ssd CSI; GCLB Ingress; Workload Identity for IAM.",
  onprem: "Vanilla K8s / OpenShift / Rancher — CSI driver, MetalLB / F5 / NSX-ALB load balancer, dedicated worker pools."
};

function fmtGB(n) {
  if (n >= 1024) return (n / 1024).toFixed(1) + " TB";
  return n + " GB";
}

/* =============================================================================
   CSV export. buildSizingCsv(r) serializes a render() result object into a
   multi-section CSV. It introspects r, so it works for both the single-cluster
   page (index.html) and the Active+Passive page (ha-index.html).
   ============================================================================= */

function csvEscape(v) {
  if (v == null) v = "";
  v = String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function buildSizingCsv(r) {
  const L = [];
  const row = (...cells) => L.push(cells.map(csvEscape).join(","));
  const blank = () => L.push("");

  const deployLabel = r.deployment === "k8s" ? "Kubernetes" : "Virtual Machines";
  const isAP = r.topology === "active-passive";

  row("JFrog Platform Deployment (JPD) Sizing — Export");
  row("Generated", new Date().toISOString());
  blank();

  /* Inputs */
  row("[INPUTS]");
  row("Field", "Value");
  row("Target environment", r.cloudLabel);
  row("Deployment model", deployLabel);
  if (r.topology) row("Topology", isAP ? "Active + Passive (DR)" : "Single active cluster");
  if (isAP) row("Passive site scale", r.passiveScale === "hot" ? "Hot (mirror)" : "Warm (minimal)");
  if (r.deployment === "k8s" && r.k8sPlacement) row("Kubernetes placement", r.k8sPlacement === "antiaffinity" ? "Anti-affinity (shared pool)" : "Dedicated node pool");
  row("Effective tier", String(r.tier || "").toUpperCase());
  row("Active concurrent clients", `${r.activeClientsInput} → ${r.activeClients} (projected)`);
  row("Peak RPM", `${r.rpmInput} → ${r.rpm} (projected)`);
  row("Binary storage (TB)", `${r.binaryTBInput} → ${r.binaryTB} (projected)`);
  row("Planned growth headroom (%)", r.growthPct);
  row("Indexed artifacts (Xray)", r.xrayEnabled ? `${r.xrayArtifactsInput} → ${r.xrayArtifacts} (projected)` : "No Xray");
  row("Local cache-fs", r.cacheFsGB > 0 ? `${r.cacheFsPct}% of binaries (${fmtGB(r.cacheFsGB)}/node)` : "Disabled");
  row("High Availability", r.ha ? "Yes (multi-replica)" : "No (single replica)");
  row("Ingress", r.externalLB ? `Load Balancer — ${r.lbDisplay}` : "JFrog NGINX (bundled)");
  if (r.externalLB) row("LB routes to", r.provisionNginx ? "NGINX (kept behind LB)" : "Artifactory (no NGINX tier)");
  row("NGINX tier provisioned", r.provisionNginx ? "Yes" : "No");
  row("RabbitMQ", !r.xrayEnabled ? "N/A (no Xray)" : (r.externalRMQ ? "External" : "Bundled"));
  row("Database", r.dbMode === "managed" ? "Managed (RDS/Cloud SQL/Flexible)" : "Self-hosted PostgreSQL");
  const svcList = [];
  if (r.svc.distribution) svcList.push("Distribution");
  if (r.svc.jas) svcList.push("JAS");
  if (r.svc.workers) svcList.push("Workers");
  if (r.svc.appTrust) svcList.push("AppTrust + UnifiedPolicy");
  if (r.svc.missionControl) svcList.push("Mission Control");
  if (r.svc.curation) svcList.push("Curation + Catalog");
  row("Optional services", svcList.join("; ") || "None");
  if (r.svc.curation) row("Valkey", r.externalValkey ? "External" : "Co-located");
  blank();

  /* Totals (computed from components so it works for either page shape) */
  const totalsOf = comps => comps.reduce((t, c) => ({
    nodes: t.nodes + c.replicas, cpu: t.cpu + c.cpu * c.replicas,
    mem: t.mem + c.memGB * c.replicas, disk: t.disk + c.diskGB * c.replicas
  }), { nodes: 0, cpu: 0, mem: 0, disk: 0 });
  const active = totalsOf(r.components);
  const passive = r.passiveComponents ? totalsOf(r.passiveComponents) : null;

  row("[AGGREGATE FOOTPRINT]");
  row("Scope", "Nodes", "vCPU", "RAM (GB)", "Service disk (GB)");
  if (isAP && passive) {
    row("Active site", active.nodes, active.cpu, active.mem, active.disk);
    row("Passive site", passive.nodes, passive.cpu, passive.mem, passive.disk);
    row("Grand total", active.nodes + passive.nodes, active.cpu + passive.cpu, active.mem + passive.mem, active.disk + passive.disk);
  } else {
    row("Total", active.nodes, active.cpu, active.mem, active.disk);
  }
  row("Binary / artifact storage (TB)", isAP ? r.binaryTB * 2 : r.binaryTB);
  blank();

  /* Per-component sizing */
  row("[PER-COMPONENT SIZING]");
  row("Site", "Component", "Replicas", "vCPU (each)", "RAM GB (each)", "Disk GB (each)", "IOPS", "Instance / VM", "Total vCPU", "Total RAM (GB)", "Total disk (GB)", "Notes");
  const compRows = (comps, site) => comps.forEach(c =>
    row(site, c.name, c.replicas, c.cpu, c.memGB, c.diskGB, c.iops, c.instance, c.cpu * c.replicas, c.memGB * c.replicas, c.diskGB * c.replicas, c.note));
  compRows(r.components, isAP ? "Active" : "—");
  if (isAP && r.passiveComponents) compRows(r.passiveComponents, "Passive");
  blank();

  /* Kubernetes cluster plan */
  if (r.deployment === "k8s") {
    const managedDb = r.dbMode === "managed";
    const planFor = comps => {
      const workers = comps.filter(c => !(managedDb && c.name.startsWith("PostgreSQL")));
      const pools = {};
      workers.forEach(c => { (pools[c.instance] = pools[c.instance] || { cpu: c.cpu, memGB: c.memGB, count: 0 }).count += c.replicas; });
      const nodes = Object.values(pools).reduce((s, p) => s + p.count, 0);
      const cpu = Object.values(pools).reduce((s, p) => s + p.cpu * p.count, 0);
      const mem = Object.values(pools).reduce((s, p) => s + p.memGB * p.count, 0);
      return { pools, nodes, cpu, mem, clusterCpu: Math.ceil(cpu * 1.15), clusterMem: Math.ceil(mem * 1.15) };
    };
    row("[KUBERNETES CLUSTER PLAN]");
    row("Site", "Node pool (VM)", "vCPU", "RAM (GB)", "Nodes");
    const planSection = (comps, site) => {
      const p = planFor(comps);
      Object.entries(p.pools).sort((a, b) => b[1].count - a[1].count).forEach(([inst, info]) => row(site, inst, info.cpu, info.memGB, info.count));
      row(site + " — total worker capacity", "", p.cpu, p.mem, p.nodes);
      row(site + " — provision (incl. ~15% sys)", "", p.clusterCpu, p.clusterMem, "");
    };
    planSection(r.components, isAP ? "Active" : "Cluster");
    if (isAP && r.passiveComponents) planSection(r.passiveComponents, "Passive");
    blank();
  }

  /* Databases */
  row("[DATABASES]");
  row("Service", "Database", "User", "Mode");
  const mode = r.dbMode === "managed" ? "Managed" : "Self-hosted";
  row("Artifactory", "artifactory", "artifactory", mode);
  if (r.xrayEnabled) row(`Xray${r.svc.jas ? " + JAS" : ""}`, "xraydb", "xray", mode);
  if (r.svc.distribution) row("Distribution", "distribution", "distribution", mode);
  if (r.svc.missionControl) row("Mission Control", "mission_control", "mission_control", mode);
  if (r.svc.curation) row("Catalog (Curation)", "catalogdb", "catalog", mode);
  blank();

  /* External services (recommended, not in footprint) */
  const ext = [];
  if (r.xrayEnabled && r.externalRMQ && r.externalRmqSpec) {
    const s = r.externalRmqSpec;
    ext.push(["RabbitMQ", `${s.replicas} × ${s.instance}`, `${s.cpu} vCPU / ${s.memGB} GB`, fmtGB(s.diskGB)]);
  }
  if (r.svc.curation && r.externalValkey && r.externalValkeySpec) {
    const v = r.externalValkeySpec;
    ext.push(["Valkey", `${v.replicas} × ${v.instance}`, `${v.cpu} vCPU / ${v.memGB} GB`, fmtGB(v.diskGB)]);
  }
  if (ext.length) {
    row("[EXTERNAL SERVICES — recommended, provisioned separately]");
    row("Service", "Cluster", "Per-node spec", "Disk");
    ext.forEach(e => row(...e));
    blank();
  }

  return L.join("\r\n");
}

function downloadCsv(r) {
  if (!r) return;
  const blob = new Blob([buildSizingCsv(r)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jpd-sizing-${r.cloud}-${r.tier}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
