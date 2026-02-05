"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Cloud,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Globe,
  Lock,
  Shield,
  Code,
  Terminal,
  GitBranch,
  FileCode,
  Box,
  Package,
  Zap,
  Activity,
  Briefcase,
  Building2,
  Users,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  BarChart2,
  PieChart,
  Wallet,
  ShoppingCart,
  Home,
  Settings,
  Search,
  Star,
  Heart,
  Bookmark,
  Image,
  FileText,
  Folder,
  Trash2,
  Edit,
  Plus,
  Minus,
  Check,
  X,
  AlertCircle,
  Info,
  HelpCircle,
} from "lucide-react";
import {
  SiAmazon,
  SiAmazonwebservices,
  SiGooglecloud,
  SiKubernetes,
  SiDocker,
  SiReact,
  SiNodedotjs,
  SiNextdotjs,
  SiVercel,
  SiVite,
  SiTailwindcss,
  SiPostgresql,
  SiMongodb,
  SiRedis,
  SiPython,
  SiJavascript,
  SiTypescript,
  SiGithub,
  SiGitlab,
  SiFigma,
  SiSlack,
  SiDiscord,
  SiLinkedin,
  SiX,
  SiYoutube,
  SiAngular,
  SiVuedotjs,
  SiSvelte,
  SiDigitalocean,
  SiMysql,
  SiMariadb,
  SiElasticsearch,
  SiApachekafka,
  SiRabbitmq,
  SiGraphql,
  SiOpenai,
  SiLangchain,
  SiTerraform,
  SiPrometheus,
  SiGrafana,
  SiJenkins,
  SiDatadog,
} from "react-icons/si";
import { FaAws, FaMicrosoft, FaCloudflare, FaGitAlt } from "react-icons/fa";
// Generic developer-icons React components. Individual icons are referenced by name at usage time.
// See https://xandemon.github.io/developer-icons/ for the full catalog.
import * as DevIcons from "developer-icons";


export type IconDefinition = {
  id: string;
  label: string;
  category: string;
  Icon: LucideIcon | React.ComponentType<{ className?: string; size?: number }>;
};

const LUCIDE = (
  Icon: LucideIcon,
  label: string,
  category: string,
  slug: string
): IconDefinition => ({ id: `lucide:${slug}`, label, category, Icon });

const REACT_ICON = (
  Icon: React.ComponentType<{ className?: string; size?: number }>,
  id: string,
  label: string,
  category: string
): IconDefinition => ({ id: `si:${id}`, label, category, Icon });

const DEV_ICON = (
  iconName: keyof typeof DevIcons,
  id: string,
  label: string,
  category: string
): IconDefinition => {
  const IconComp = DevIcons[iconName] as React.ComponentType<{ className?: string; size?: number }>;
  return { id: `dev:${id}`, label, category, Icon: IconComp };
};

export const ICON_CATEGORIES: Record<string, string> = {
  arrows: "Arrows",
  tech: "Tech / Cloud",
  business: "Business",
  communication: "Communication",
  files: "Files & Folders",
  ui: "UI & Actions",
  social: "Social & Media",
  alerts: "Alerts & Status",
};

export const ICON_REGISTRY: IconDefinition[] = [
  LUCIDE(ArrowRight, "Arrow Right", "arrows", "arrow-right"),
  LUCIDE(ArrowLeft, "Arrow Left", "arrows", "arrow-left"),
  LUCIDE(ArrowUp, "Arrow Up", "arrows", "arrow-up"),
  LUCIDE(ArrowDown, "Arrow Down", "arrows", "arrow-down"),
  LUCIDE(ChevronRight, "Chevron Right", "arrows", "chevron-right"),
  LUCIDE(ChevronDown, "Chevron Down", "arrows", "chevron-down"),
  LUCIDE(Cloud, "Cloud", "tech", "cloud"),
  LUCIDE(Server, "Server", "tech", "server"),
  LUCIDE(Database, "Database", "tech", "database"),
  LUCIDE(Cpu, "CPU", "tech", "cpu"),
  LUCIDE(HardDrive, "Storage", "tech", "hard-drive"),
  LUCIDE(Wifi, "WiFi", "tech", "wifi"),
  LUCIDE(Globe, "Globe", "tech", "globe"),
  LUCIDE(Lock, "Lock", "tech", "lock"),
  LUCIDE(Shield, "Shield", "tech", "shield"),
  LUCIDE(Code, "Code", "tech", "code"),
  LUCIDE(Terminal, "Terminal", "tech", "terminal"),
  LUCIDE(GitBranch, "Git Branch", "tech", "git-branch"),
  LUCIDE(FileCode, "File Code", "tech", "file-code"),
  LUCIDE(Box, "Box", "tech", "box"),
  LUCIDE(Package, "Package", "tech", "package"),
  LUCIDE(Zap, "Zap", "tech", "zap"),
  LUCIDE(Activity, "Activity", "tech", "activity"),
  REACT_ICON(SiAmazon, "Amazon", "Amazon", "tech"),
  REACT_ICON(SiAmazonwebservices, "AWS", "AWS", "tech"),
  REACT_ICON(SiGooglecloud, "Google Cloud", "Google Cloud", "tech"),
  REACT_ICON(SiKubernetes, "Kubernetes", "Kubernetes", "tech"),
  REACT_ICON(SiDocker, "Docker", "Docker", "tech"),
  REACT_ICON(SiReact, "React", "React", "tech"),
  REACT_ICON(SiNodedotjs, "Node.js", "Node.js", "tech"),
  REACT_ICON(SiNextdotjs, "Next.js", "Next.js", "tech"),
  REACT_ICON(SiVercel, "Vercel", "Vercel", "tech"),
  REACT_ICON(SiVite, "Vite", "Vite", "tech"),
  REACT_ICON(SiTailwindcss, "Tailwind CSS", "Tailwind CSS", "tech"),
  REACT_ICON(SiPostgresql, "PostgreSQL", "PostgreSQL", "tech"),
  REACT_ICON(SiMongodb, "MongoDB", "MongoDB", "tech"),
  REACT_ICON(SiRedis, "Redis", "Redis", "tech"),
  REACT_ICON(SiPython, "Python", "Python", "tech"),
  REACT_ICON(SiJavascript, "JavaScript", "JavaScript", "tech"),
  REACT_ICON(SiTypescript, "TypeScript", "TypeScript", "tech"),
  REACT_ICON(SiGithub, "GitHub", "GitHub", "tech"),
  REACT_ICON(SiGitlab, "GitLab", "GitLab", "tech"),
  REACT_ICON(SiFigma, "Figma", "Figma", "tech"),
  REACT_ICON(SiOpenai, "OpenAI", "OpenAI", "tech"),
  REACT_ICON(SiLangchain, "LangChain", "LangChain", "tech"),
  REACT_ICON(SiTerraform, "Terraform", "Terraform", "tech"),
  REACT_ICON(SiPrometheus, "Prometheus", "Prometheus", "tech"),
  REACT_ICON(SiGrafana, "Grafana", "Grafana", "tech"),
  REACT_ICON(SiJenkins, "Jenkins", "Jenkins", "tech"),
  REACT_ICON(SiDatadog, "Datadog", "Datadog", "tech"),
  REACT_ICON(FaAws, "AWS (alt)", "AWS", "tech"),
  REACT_ICON(FaMicrosoft, "Microsoft", "Microsoft", "tech"),
  REACT_ICON(FaCloudflare, "Cloudflare", "Cloudflare", "tech"),
  REACT_ICON(FaGitAlt, "Git", "Git", "tech"),
  REACT_ICON(SiAngular, "Angular", "Angular", "tech"),
  REACT_ICON(SiVuedotjs, "Vue.js", "Vue.js", "tech"),
  REACT_ICON(SiSvelte, "Svelte", "Svelte", "tech"),
  REACT_ICON(SiDigitalocean, "DigitalOcean", "DigitalOcean", "tech"),
  REACT_ICON(SiMysql, "MySQL", "MySQL", "tech"),
  REACT_ICON(SiMariadb, "MariaDB", "MariaDB", "tech"),
  REACT_ICON(SiElasticsearch, "Elasticsearch", "Elasticsearch", "tech"),
  REACT_ICON(SiApachekafka, "Kafka", "Kafka", "tech"),
  REACT_ICON(SiRabbitmq, "RabbitMQ", "RabbitMQ", "tech"),
  REACT_ICON(SiGraphql, "GraphQL", "GraphQL", "tech"),
  // Additional tech icons from developer-icons (ids prefixed with "dev:")
  DEV_ICON("AWS", "aws", "AWS (dev-icon)", "tech"),

  DEV_ICON("Kubernetes", "kubernetes", "Kubernetes (dev-icon)", "tech"),
  DEV_ICON("Docker", "docker-dev", "Docker (dev-icon)", "tech"),
  DEV_ICON("PostgreSQL", "postgresql-dev", "PostgreSQL (dev-icon)", "tech"),
  DEV_ICON("MongoDB", "mongodb-dev", "MongoDB (dev-icon)", "tech"),
  DEV_ICON("Redis", "redis-dev", "Redis (dev-icon)", "tech"),
  LUCIDE(Briefcase, "Briefcase", "business", "briefcase"),
  LUCIDE(Building2, "Building", "business", "building"),
  LUCIDE(Users, "Users", "business", "users"),
  LUCIDE(BarChart2, "Chart", "business", "bar-chart"),
  LUCIDE(PieChart, "Pie Chart", "business", "pie-chart"),
  LUCIDE(Wallet, "Wallet", "business", "wallet"),
  LUCIDE(ShoppingCart, "Cart", "business", "shopping-cart"),
  LUCIDE(Mail, "Mail", "communication", "mail"),
  LUCIDE(MessageSquare, "Message", "communication", "message-square"),
  LUCIDE(Phone, "Phone", "communication", "phone"),
  LUCIDE(Calendar, "Calendar", "communication", "calendar"),
  LUCIDE(FileText, "File", "files", "file-text"),
  LUCIDE(Folder, "Folder", "files", "folder"),
  LUCIDE(Image, "Image", "files", "image"),
  LUCIDE(Home, "Home", "ui", "home"),
  LUCIDE(Settings, "Settings", "ui", "settings"),
  LUCIDE(Search, "Search", "ui", "search"),
  LUCIDE(Star, "Star", "ui", "star"),
  LUCIDE(Heart, "Heart", "ui", "heart"),
  LUCIDE(Bookmark, "Bookmark", "ui", "bookmark"),
  LUCIDE(Trash2, "Trash", "ui", "trash"),
  LUCIDE(Edit, "Edit", "ui", "edit"),
  LUCIDE(Plus, "Plus", "ui", "plus"),
  LUCIDE(Minus, "Minus", "ui", "minus"),
  LUCIDE(Check, "Check", "ui", "check"),
  LUCIDE(X, "Close", "ui", "x"),
  REACT_ICON(SiSlack, "Slack", "Slack", "social"),
  REACT_ICON(SiDiscord, "Discord", "Discord", "social"),
  REACT_ICON(SiLinkedin, "LinkedIn", "LinkedIn", "social"),
  REACT_ICON(SiX, "X (Twitter)", "X", "social"),
  REACT_ICON(SiYoutube, "YouTube", "YouTube", "social"),
  LUCIDE(AlertCircle, "Alert", "alerts", "alert-circle"),
  LUCIDE(Info, "Info", "alerts", "info"),
  LUCIDE(HelpCircle, "Help", "alerts", "help-circle"),
];

export { ICON_IDS_FOR_PROMPT } from "./icon-prompt-list";

function normalizeIconId(id: string): string[] {
  const trimmed = id.trim();
  if (!trimmed) return [id];
  const [lib, name] = trimmed.split(":");
  const candidates: string[] = [trimmed];
  if (lib && name) {
    if (lib === "si" && name.startsWith("Si")) candidates.push(`${lib}:${name.slice(2)}`);
    if (lib === "si") candidates.push(`${lib}:${name.charAt(0).toUpperCase()}${name.slice(1)}`);
  }
  return candidates;
}

export function getIconById(id: string | null | undefined): IconDefinition | null {
  if (!id) return null;
  for (const candidate of normalizeIconId(id)) {
    const def = ICON_REGISTRY.find((d) => d.id === candidate);
    if (def) return def;
  }
  return null;
}
