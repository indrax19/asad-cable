import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Package,
  Users,
  MapPin,
  Receipt,
  UserCog,
  Wifi,
  LogOut,
  FileText,
  User,
  CreditCard,
  ImageIcon,
  TrendingUp,
  ClipboardList,
  PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdvertisementModal } from "@/components/advertisement-modal";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  group?: string;
}

const NAV: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "dealer"], group: "Main" },
  { title: "My Bills", url: "/my-bills", icon: FileText, roles: ["customer"], group: "Main" },
  { title: "Payment Methods", url: "/payment-details", icon: CreditCard, roles: ["customer"], group: "Main" },
  { title: "Packages", url: "/packages", icon: Package, roles: ["admin"], group: "Main" },
  { title: "Areas", url: "/areas", icon: MapPin, roles: ["admin"], group: "Main" },
  { title: "Dealers", url: "/dealers", icon: UserCog, roles: ["admin"], group: "Main" },
  { title: "Users", url: "/users", icon: Users, roles: ["admin", "dealer"], group: "Main" },
  { title: "Payments", url: "/payments", icon: Receipt, roles: ["admin", "dealer"], group: "Main" },
  {
    title: "Payment Methods",
    url: "/payment-methods",
    icon: CreditCard,
    roles: ["admin", "dealer"],
    group: "Main",
  },
  { title: "Performance", url: "/performance", icon: TrendingUp, roles: ["admin"], group: "Analytics" },
  { title: "Payment Corrections", url: "/payment-corrections", icon: ClipboardList, roles: ["admin"], group: "Analytics" },
  { title: "Reports", url: "/reports", icon: PieChart, roles: ["admin", "dealer"], group: "Analytics" },
  { title: "Advertisements", url: "/advertisements", icon: ImageIcon, roles: ["admin"], group: "Main" },
  { title: "Profile", url: "/profile", icon: User, roles: ["admin", "dealer", "customer"], group: "Main" },
];

function AuthedLayout() {
  const { fbUser, user, role, loading, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !fbUser) nav({ to: "/login" });
  }, [loading, fbUser, nav]);

  useEffect(() => {
    if (!loading && user && user.status === "disabled") {
      signOut().then(() => nav({ to: "/login" }));
    }
  }, [loading, user, nav, signOut]);

  if (loading || !fbUser) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-3 text-center p-6">
        <p className="text-muted-foreground">Your profile is missing. Contact an admin.</p>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }
  if (user.status === "disabled") {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-3 text-center p-6">
        <p className="text-muted-foreground">
          Your account has been disabled. Please contact an administrator.
        </p>
        <Button variant="outline" onClick={() => signOut().then(() => nav({ to: "/login" }))}>
          Sign out
        </Button>
      </div>
    );
  }

  const items = NAV.filter((i) => i.roles.includes(role));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30 flex-col">
        <div className="flex flex-1">
          <AppSidebar items={items} />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar />
            <main className="flex-1 p-4 md:p-6 overflow-x-auto">
              <Outlet />
            </main>
          </div>
        </div>
        <Footer />
      </div>
      {role === "customer" && <AdvertisementModal />}
    </SidebarProvider>
  );
}

function AppSidebar({ items }: { items: NavItem[] }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Group items by their group property
  const groupedItems = items.reduce(
    (acc, item) => {
      const groupName = item.group || "Main";
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(item);
      return acc;
    },
    {} as Record<string, NavItem[]>,
  );

  // Define group order
  const groupOrder = ["Main", "Analytics"];
  const sortedGroups = groupOrder.filter((g) => groupedItems[g]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
        >
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F518d4435749b420eb67d4c19800a67f3%2F7e03c52884ca4f978cc752b14e5add8b?format=webp&width=800&height=1200"
            alt="ASAD Logo"
            className="size-8 rounded-md"
          />
          <div className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            ASAD Cable & Internet
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {sortedGroups.map((groupName) => (
          <SidebarGroup key={groupName}>
            <SidebarGroupLabel>{groupName}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {groupedItems[groupName].map((item) => {
                  const active = path === item.url || path.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        onClick={handleNavClick}
                      >
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-background px-4 md:px-6 py-3 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} ASAD Cable & Internet. All rights reserved.
    </footer>
  );
}

function ClockDisplay() {
  const [currentDateTime, setCurrentDateTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateString = now.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timeString = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentDateTime(`${dateString} ${timeString}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <div className="text-sm text-muted-foreground hidden sm:block">{currentDateTime}</div>;
}

function Topbar() {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <div className="hidden md:block text-sm text-muted-foreground capitalize">{role} panel</div>
      </div>
      <div className="flex items-center gap-4">
        <ClockDisplay />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-9">
              <Avatar className="size-7">
                <AvatarFallback>{user?.name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => nav({ to: "/profile" })}>Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                nav({ to: "/login" });
              }}
            >
              <LogOut className="size-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
