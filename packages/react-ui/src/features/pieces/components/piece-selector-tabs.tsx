import { t } from 'i18next';
import { LayoutGridIcon, ZapIcon } from 'lucide-react';

import { Tabs, TabsTrigger, TabsList } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import {
  PieceSelectorTabType,
  usePieceSelectorTabs,
} from '../lib/piece-selector-tabs-provider';

type IconProps = React.SVGProps<SVGSVGElement>;

const AiAgentIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 22 19"
    width={20}
    height={18}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M3 13C2.16667 13 1.45833 12.7083 0.875 12.125C0.291667 11.5417 0 10.8333 0 10C0 9.16667 0.291667 8.45833 0.875 7.875C1.45833 7.29167 2.16667 7 3 7V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H8C8 2.16667 8.29167 1.45833 8.875 0.875C9.45833 0.291667 10.1667 0 11 0C11.8333 0 12.5417 0.291667 13.125 0.875C13.7083 1.45833 14 2.16667 14 3H17C17.55 3 18.0208 3.19583 18.4125 3.5875C18.8042 3.97917 19 4.45 19 5V7C19.8333 7 20.5417 7.29167 21.125 7.875C21.7083 8.45833 22 9.16667 22 10C22 10.8333 21.7083 11.5417 21.125 12.125C20.5417 12.7083 19.8333 13 19 13V17C19 17.55 18.8042 18.0208 18.4125 18.4125C18.0208 18.8042 17.55 19 17 19H5C4.45 19 3.97917 18.8042 3.5875 18.4125C3.19583 18.0208 3 17.55 3 17V13ZM8 11C8.41667 11 8.77083 10.8542 9.0625 10.5625C9.35417 10.2708 9.5 9.91667 9.5 9.5C9.5 9.08333 9.35417 8.72917 9.0625 8.4375C8.77083 8.14583 8.41667 8 8 8C7.58333 8 7.22917 8.14583 6.9375 8.4375C6.64583 8.72917 6.5 9.08333 6.5 9.5C6.5 9.91667 6.64583 10.2708 6.9375 10.5625C7.22917 10.8542 7.58333 11 8 11ZM14 11C14.4167 11 14.7708 10.8542 15.0625 10.5625C15.3542 10.2708 15.5 9.91667 15.5 9.5C15.5 9.08333 15.3542 8.72917 15.0625 8.4375C14.7708 8.14583 14.4167 8 14 8C13.5833 8 13.2292 8.14583 12.9375 8.4375C12.6458 8.72917 12.5 9.08333 12.5 9.5C12.5 9.91667 12.6458 10.2708 12.9375 10.5625C13.2292 10.8542 13.5833 11 14 11ZM7 15L11 15.5L15 15V13L11 13.5L7 13V15ZM5 17H17V5H5V17Z"
      fill="currentColor"
    />
  </svg>
);

const ChannelIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 18"
    width={20}
    height={18}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 2C5.4683 2 2.00002 5.24178 2.00002 9C2.00002 10.3513 2.43831 11.6186 3.20915 12.6993C3.40238 12.9702 3.44819 13.3195 3.33134 13.6311L2.56804 15.6666L5.5489 15.0704C5.75979 15.0282 5.97865 15.0552 6.17302 15.1472C7.36799 15.7131 8.67443 16.0045 9.99661 16L10 16C14.5317 16 18 12.7582 18 9C18 5.24178 14.5317 2 10 2ZM1.52069e-05 9C1.52069e-05 3.92222 4.59173 0 10 0C15.4083 0 20 3.92222 20 9C20 14.0772 15.4093 17.9992 10.0017 18C10.0012 18 10.0006 18 10 18V17L10.0034 18C10.0029 18 10.0023 18 10.0017 18C8.49463 18.0049 7.00427 17.6961 5.62501 17.0948L5.94113 17.0316L5.74502 16.051L5.31701 16.9548C5.41902 17.0031 5.5217 17.0498 5.62501 17.0948L1.19613 17.9806C0.840093 18.0518 0.47343 17.9244 0.238216 17.6478C0.00300182 17.3712 -0.0638032 16.9888 0.063686 16.6489L1.27881 13.4085C1.37477 13.5622 1.47553 13.713 1.58088 13.8607L2.39502 13.28L1.45869 12.9289L1.27881 13.4085C0.468275 12.1107 1.52069e-05 10.6065 1.52069e-05 9ZM5.00002 9C5.00002 8.44772 5.44773 8 6.00002 8H6.01002C6.5623 8 7.01002 8.44772 7.01002 9C7.01002 9.55229 6.5623 10 6.01002 10H6.00002C5.44773 10 5.00002 9.55229 5.00002 9ZM9.00002 9C9.00002 8.44772 9.44773 8 10 8H10.01C10.5623 8 11.01 8.44772 11.01 9C11.01 9.55229 10.5623 10 10.01 10H10C9.44773 10 9.00002 9.55229 9.00002 9ZM13 9C13 8.44772 13.4477 8 14 8H14.01C14.5623 8 15.01 8.44772 15.01 9C15.01 9.55229 14.5623 10 14.01 10H14C13.4477 10 13 9.55229 13 9Z"
      fill="currentColor"
    />
  </svg>
);

const IntegrationsIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 19 19"
    width={19}
    height={19}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M18 0H0.75C0.335156 0 0 0.335156 0 0.75V18C0 18.4148 0.335156 18.75 0.75 18.75H18C18.4148 18.75 18.75 18.4148 18.75 18V0.75C18.75 0.335156 18.4148 0 18 0ZM17.0625 17.0625H1.6875V1.6875H17.0625V17.0625ZM4.51875 9.65625H5.70703C5.79375 9.65625 5.86641 9.58594 5.86641 9.49688V7.64766C5.86641 7.18594 6.23906 6.81328 6.69844 6.81328H11.5195V8.06484C11.5195 8.19844 11.6719 8.27109 11.775 8.18906L14.332 6.18047C14.4141 6.11719 14.4141 5.99297 14.332 5.92969L11.775 3.92109C11.6719 3.83906 11.5195 3.91406 11.5195 4.04531V5.29688H6.69609C5.40469 5.29688 4.35938 6.34688 4.35938 7.64297V9.49219C4.35938 9.58594 4.42969 9.65625 4.51875 9.65625ZM4.42031 12.818L6.97734 14.8266C7.08047 14.9086 7.23281 14.8336 7.23281 14.7023V13.4508H12.0539C13.3453 13.4508 14.3906 12.4008 14.3906 11.1047V9.25547C14.3906 9.16875 14.3203 9.09609 14.2313 9.09609H13.043C12.9563 9.09609 12.8836 9.16641 12.8836 9.25547V11.1047C12.8836 11.5664 12.5109 11.9391 12.0516 11.9391H7.23281V10.6875C7.23281 10.5539 7.08047 10.4813 6.97734 10.5633L4.42031 12.5719C4.33828 12.6305 4.33828 12.7547 4.42031 12.818Z"
      fill="currentColor"
    />
  </svg>
);

const FunctionIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 16 17"
    width={16}
    height={17}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M15.4516 4.91953C15.5219 4.84219 15.5149 4.725 15.4375 4.65469C15.4024 4.62422 15.3579 4.60547 15.3133 4.60547H13.6118C13.5555 4.60547 13.5039 4.62891 13.4688 4.67109L10.5883 8.07422C10.5204 8.15391 10.4032 8.16328 10.3235 8.09531C10.3024 8.07656 10.286 8.05547 10.2743 8.02969L8.78598 4.71797C8.75551 4.65 8.68988 4.60781 8.61488 4.60781H4.66332L4.68442 4.49766L4.87192 3.50625C5.11801 2.20781 5.76254 1.59844 6.88285 1.59844C7.31879 1.59844 7.71488 1.63828 8.0266 1.70859L8.35707 0.142969C7.82738 0.0328123 7.53207 0 7.07035 0C4.64926 0 3.40473 1.03828 2.9477 3.45234L2.72738 4.61016H0.439884C0.350822 4.61016 0.273478 4.67344 0.257071 4.76016L0.00394636 5.97422C-0.0171474 6.075 0.0484779 6.17578 0.149259 6.19687C0.160978 6.19922 0.17504 6.20156 0.186759 6.20156H2.39692L0.310978 16.2773C0.289884 16.3781 0.355509 16.4789 0.45629 16.5C0.468009 16.5023 0.482072 16.5047 0.49379 16.5047H2.04535C2.13442 16.5047 2.21176 16.4414 2.22817 16.3547L4.33051 6.20391H7.51332L9.11176 9.46406C9.14457 9.53203 9.1352 9.61406 9.08363 9.67031L4.85082 14.4281C4.78285 14.5055 4.78988 14.625 4.86723 14.693C4.90238 14.7234 4.94692 14.7398 4.99145 14.7398H6.69535C6.7516 14.7398 6.80316 14.7164 6.83832 14.6742L9.73754 11.2359C9.80317 11.1562 9.9227 11.1469 10.0024 11.2125C10.0235 11.2312 10.0399 11.2523 10.0516 11.2781L11.5938 14.6227C11.6243 14.6883 11.6899 14.7328 11.7649 14.7328H13.2789C13.3821 14.7328 13.4664 14.6484 13.4664 14.5453C13.4664 14.5172 13.4594 14.4891 13.4477 14.4633L11.2164 9.80156C11.1836 9.73359 11.1954 9.65156 11.2469 9.59531L15.4516 4.91953Z"
      fill="currentColor"
    />
  </svg>
);

const ActionsIcon = (props: IconProps) => <ZapIcon {...props} />;

const InternalUseIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 16 20"
    width={16}
    height={20}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M6 2V0H0V20H6V18H2V2H6ZM10 18V20H16V0H10V2H14V18H10Z"
      fill="currentColor"
    />
  </svg>
);

const LogicsIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 20 20"
    width={20}
    height={20}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M17.864 6.465C18.0047 5.97116 18.0352 5.45243 17.9534 4.94551C17.8715 4.43858 17.6792 3.95583 17.3902 3.53141C17.1011 3.10699 16.7223 2.75127 16.2806 2.48941C15.8389 2.22754 15.3451 2.06593 14.834 2.016C14.6289 1.42762 14.246 0.917531 13.7383 0.556347C13.2306 0.195163 12.6231 0.000744078 12 0C11.2596 0.00250783 10.5466 0.280565 10 0.78C9.45338 0.280565 8.74042 0.00250783 8 0C6.699 0 5.59 0.831 5.175 2.015C4.66303 2.06368 4.16805 2.22442 3.72517 2.48583C3.28228 2.74723 2.90235 3.1029 2.61232 3.52759C2.32229 3.95228 2.12927 4.43559 2.04695 4.94324C1.96463 5.45088 1.99503 5.97042 2.136 6.465C1.49403 6.80655 0.956501 7.31552 0.580434 7.93789C0.204368 8.56027 0.00379597 9.27284 0 10C0 11.075 0.428 12.086 1.172 12.832C1.05816 13.2109 1.00022 13.6044 1 14C1 15.957 2.412 17.59 4.306 17.934C4.58405 18.5485 5.03303 19.0701 5.59938 19.4364C6.16572 19.8027 6.82551 19.9984 7.5 20C8.479 20 9.364 19.593 10 18.941C10.3246 19.2759 10.7132 19.5421 11.1426 19.724C11.572 19.906 12.0336 19.9998 12.5 20C13.1733 19.9988 13.832 19.8039 14.3976 19.4386C14.9632 19.0734 15.4119 18.5532 15.69 17.94C16.248 17.8416 16.7787 17.626 17.2472 17.3074C17.7157 16.9888 18.1113 16.5745 18.4078 16.0918C18.7044 15.609 18.8952 15.0689 18.9676 14.507C19.04 13.945 18.9925 13.3742 18.828 12.832C19.1998 12.4601 19.4947 12.0185 19.6958 11.5326C19.8969 11.0467 20.0002 10.5259 20 10C19.9962 9.27284 19.7956 8.56027 19.4196 7.93789C19.0435 7.31552 18.506 6.80655 17.864 6.465ZM7.5 18C6.789 18 6.17 17.496 6.03 16.802L5.818 16H5C3.897 16 3 15.103 3 14C3 13.648 3.085 13.318 3.253 13.019L3.709 12.203L2.925 11.693C2.64178 11.5104 2.40877 11.2598 2.24721 10.9641C2.08564 10.6684 2.00065 10.337 2 10C2 9.023 2.723 8.176 3.682 8.028L5.375 7.768L4.316 6.422C4.12741 6.17887 4.01804 5.88369 4.00268 5.57637C3.98732 5.26906 4.06672 4.96444 4.23013 4.70372C4.39355 4.44301 4.63309 4.23877 4.91637 4.11863C5.19964 3.99849 5.51298 3.96825 5.814 4.032L7 4.207V3C7 2.73478 7.10536 2.48043 7.29289 2.29289C7.48043 2.10536 7.73478 2 8 2C8.26522 2 8.51957 2.10536 8.70711 2.29289C8.89464 2.48043 9 2.73478 9 3V16.5C9 17.327 8.327 18 7.5 18ZM17.075 11.692L16.291 12.202L16.747 13.018C16.915 13.318 17 13.648 17 14C17 15.103 16.103 16 14.95 16H14.132L13.97 16.802C13.9001 17.1403 13.7157 17.4441 13.448 17.6623C13.1802 17.8805 12.8454 17.9998 12.5 18C11.673 18 11 17.327 11 16.5V3C11 2.448 11.448 2 12 2C12.552 2 13 2.448 13 3.05V4.257L14.186 4.032C14.487 3.96825 14.8004 3.99849 15.0836 4.11863C15.3669 4.23877 15.6065 4.44301 15.7699 4.70372C15.9333 4.96444 16.0127 5.26906 15.9973 5.57637C15.982 5.88369 15.8726 6.17887 15.684 6.422L14.625 7.769L16.318 8.029C16.7865 8.10486 17.2128 8.34468 17.5209 8.70569C17.8289 9.0667 17.9988 9.52541 18 10C18 10.683 17.654 11.315 17.075 11.692Z"
      fill="currentColor"
    />
  </svg>
);

type TabConfig = {
  value: PieceSelectorTabType;
  name: string;
};

const tabsRow1: TabConfig[] = [
  {
    value: PieceSelectorTabType.ALL,
    name: 'All',
  },
  {
    value: PieceSelectorTabType.AI_AGENTS,
    name: 'AI Agents',
  },
  {
    value: PieceSelectorTabType.CHANNEL_ACTIONS,
    name: 'Channel Actions',
  },
  {
    value: PieceSelectorTabType.INTEGRATIONS,
    name: 'Integrations',
  },
  {
    value: PieceSelectorTabType.FUNCTIONS,
    name: 'Functions',
  },
];

const tabsRow2: TabConfig[] = [
  {
    value: PieceSelectorTabType.ACTIONS,
    name: 'Actions',
  },
  {
    value: PieceSelectorTabType.INTERNAL_USE,
    name: 'Internal Use',
  },
  {
    value: PieceSelectorTabType.LOGICS,
    name: 'Logics',
  },
];

const getIconComponent = (value: PieceSelectorTabType) => {
  switch (value) {
    case PieceSelectorTabType.AI_AGENTS:
      return AiAgentIcon;
    case PieceSelectorTabType.CHANNEL_ACTIONS:
      return ChannelIcon;
    case PieceSelectorTabType.INTEGRATIONS:
      return IntegrationsIcon;
    case PieceSelectorTabType.FUNCTIONS:
      return FunctionIcon;
    case PieceSelectorTabType.ACTIONS:
      return ActionsIcon;
    case PieceSelectorTabType.INTERNAL_USE:
      return InternalUseIcon;
    case PieceSelectorTabType.LOGICS:
      return LogicsIcon;
    default:
      return null;
  }
};

const renderIcon = (tab: TabConfig, isActive: boolean) => {
  if (tab.value === PieceSelectorTabType.ALL) {
    return (
      <LayoutGridIcon
        className={cn(
          'size-5 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )}
      />
    );
  }

  const Icon = getIconComponent(tab.value);
  if (!Icon) return null;

  return (
    <Icon
      className={cn(
        'h-[18px] w-5 transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
    />
  );
};

export const PieceSelectorTabs = () => {
  const { selectedTab, setSelectedTab } = usePieceSelectorTabs();
  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(value as PieceSelectorTabType)}
      className="w-full px-2 pt-2"
    >
      {/* Row 1 - 5 items */}
      <TabsList className="h-14 w-full flex p-0 bg-background rounded-none gap-0">
        {tabsRow1.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'flex flex-col items-center justify-center rounded-none bg-background h-full w-[20%] border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none',
            )}
          >
            {renderIcon(tab, selectedTab === tab.value)}
            <span className="mt-1.5 text-[12px] whitespace-nowrap">
              {t(tab.name)}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Row 2 - 4 items, aligned to right */}
      <TabsList className="h-14 w-full flex justify-end p-0 bg-background rounded-none gap-0 mt-2">
        {tabsRow2.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'flex flex-col items-center justify-center rounded-none bg-background h-full w-[20%] border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none',
            )}
          >
            {renderIcon(tab, selectedTab === tab.value)}
            <span className="mt-1.5 text-[12px] whitespace-nowrap">
              {t(tab.name)}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
