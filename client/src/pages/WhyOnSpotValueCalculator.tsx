import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  Settings,
  Plus,
  X,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Download,
  HelpCircle,
  Check,
} from "lucide-react";

type StateData = {
  cities: string[];
  minWages: Record<string, number>;
};

type LocationData = {
  [country: string]: {
    [state: string]: StateData;
  };
};

const locationData: LocationData = {
  "United States": {
    Alabama: {
      cities: ["Birmingham", "Montgomery", "Mobile", "Huntsville"],
      minWages: {
        Birmingham: 7.25,
        Montgomery: 7.25,
        Mobile: 7.25,
        Huntsville: 7.25,
      },
    },
    Alaska: {
      cities: ["Anchorage", "Fairbanks", "Juneau"],
      minWages: { Anchorage: 11.73, Fairbanks: 11.73, Juneau: 11.73 },
    },
    Arizona: {
      cities: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale"],
      minWages: {
        Phoenix: 14.35,
        Tucson: 14.35,
        Mesa: 14.35,
        Chandler: 14.35,
        Scottsdale: 14.35,
      },
    },
    Arkansas: {
      cities: ["Little Rock", "Fort Smith", "Fayetteville", "Springdale"],
      minWages: {
        "Little Rock": 11.0,
        "Fort Smith": 11.0,
        Fayetteville: 11.0,
        Springdale: 11.0,
      },
    },
    California: {
      cities: [
        "Los Angeles",
        "San Diego",
        "San Jose",
        "San Francisco",
        "Fresno",
        "Sacramento",
      ],
      minWages: {
        "Los Angeles": 16.78,
        "San Diego": 16.3,
        "San Jose": 17.55,
        "San Francisco": 18.07,
        Fresno: 16.0,
        Sacramento: 16.5,
      },
    },
    Colorado: {
      cities: ["Denver", "Colorado Springs", "Aurora", "Fort Collins"],
      minWages: {
        Denver: 18.29,
        "Colorado Springs": 14.42,
        Aurora: 14.42,
        "Fort Collins": 14.42,
      },
    },
    Connecticut: {
      cities: ["Bridgeport", "New Haven", "Hartford", "Stamford"],
      minWages: {
        Bridgeport: 15.69,
        "New Haven": 15.69,
        Hartford: 15.69,
        Stamford: 15.69,
      },
    },
    Delaware: {
      cities: ["Wilmington", "Dover", "Newark"],
      minWages: { Wilmington: 13.25, Dover: 13.25, Newark: 13.25 },
    },
    Florida: {
      cities: ["Jacksonville", "Miami", "Tampa", "Orlando", "Fort Lauderdale"],
      minWages: {
        Jacksonville: 12.0,
        Miami: 12.0,
        Tampa: 12.0,
        Orlando: 12.0,
        "Fort Lauderdale": 12.0,
      },
    },
    Georgia: {
      cities: ["Atlanta", "Columbus", "Augusta", "Savannah", "Athens"],
      minWages: {
        Atlanta: 7.25,
        Columbus: 7.25,
        Augusta: 7.25,
        Savannah: 7.25,
        Athens: 7.25,
      },
    },
    Hawaii: {
      cities: ["Honolulu", "Pearl City", "Hilo", "Kailua"],
      minWages: {
        Honolulu: 14.0,
        "Pearl City": 14.0,
        Hilo: 14.0,
        Kailua: 14.0,
      },
    },
    Idaho: {
      cities: ["Boise", "Meridian", "Nampa", "Idaho Falls"],
      minWages: {
        Boise: 7.25,
        Meridian: 7.25,
        Nampa: 7.25,
        "Idaho Falls": 7.25,
      },
    },
    Illinois: {
      cities: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford"],
      minWages: {
        Chicago: 15.8,
        Aurora: 14.0,
        Naperville: 14.0,
        Joliet: 14.0,
        Rockford: 14.0,
      },
    },
    Indiana: {
      cities: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend"],
      minWages: {
        Indianapolis: 7.25,
        "Fort Wayne": 7.25,
        Evansville: 7.25,
        "South Bend": 7.25,
      },
    },
    Iowa: {
      cities: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City"],
      minWages: {
        "Des Moines": 7.25,
        "Cedar Rapids": 7.25,
        Davenport: 7.25,
        "Sioux City": 7.25,
      },
    },
    Kansas: {
      cities: ["Wichita", "Overland Park", "Kansas City", "Topeka"],
      minWages: {
        Wichita: 7.25,
        "Overland Park": 7.25,
        "Kansas City": 7.25,
        Topeka: 7.25,
      },
    },
    Kentucky: {
      cities: ["Louisville", "Lexington", "Bowling Green", "Owensboro"],
      minWages: {
        Louisville: 7.25,
        Lexington: 7.25,
        "Bowling Green": 7.25,
        Owensboro: 7.25,
      },
    },
    Louisiana: {
      cities: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette"],
      minWages: {
        "New Orleans": 7.25,
        "Baton Rouge": 7.25,
        Shreveport: 7.25,
        Lafayette: 7.25,
      },
    },
    Maine: {
      cities: ["Portland", "Lewiston", "Bangor", "South Portland"],
      minWages: {
        Portland: 14.15,
        Lewiston: 14.15,
        Bangor: 14.15,
        "South Portland": 14.15,
      },
    },
    Maryland: {
      cities: ["Baltimore", "Columbia", "Germantown", "Silver Spring"],
      minWages: {
        Baltimore: 15.0,
        Columbia: 15.0,
        Germantown: 15.0,
        "Silver Spring": 15.0,
      },
    },
    Massachusetts: {
      cities: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell"],
      minWages: {
        Boston: 15.0,
        Worcester: 15.0,
        Springfield: 15.0,
        Cambridge: 15.0,
        Lowell: 15.0,
      },
    },
    Michigan: {
      cities: [
        "Detroit",
        "Grand Rapids",
        "Warren",
        "Sterling Heights",
        "Ann Arbor",
      ],
      minWages: {
        Detroit: 10.33,
        "Grand Rapids": 10.33,
        Warren: 10.33,
        "Sterling Heights": 10.33,
        "Ann Arbor": 10.33,
      },
    },
    Minnesota: {
      cities: ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington"],
      minWages: {
        Minneapolis: 15.57,
        "St. Paul": 15.57,
        Rochester: 10.85,
        Duluth: 10.85,
        Bloomington: 10.85,
      },
    },
    Mississippi: {
      cities: ["Jackson", "Gulfport", "Southaven", "Hattiesburg"],
      minWages: {
        Jackson: 7.25,
        Gulfport: 7.25,
        Southaven: 7.25,
        Hattiesburg: 7.25,
      },
    },
    Missouri: {
      cities: ["Kansas City", "St. Louis", "Springfield", "Columbia"],
      minWages: {
        "Kansas City": 12.3,
        "St. Louis": 12.3,
        Springfield: 12.3,
        Columbia: 12.3,
      },
    },
    Montana: {
      cities: ["Billings", "Missoula", "Great Falls", "Bozeman"],
      minWages: {
        Billings: 10.3,
        Missoula: 10.3,
        "Great Falls": 10.3,
        Bozeman: 10.3,
      },
    },
    Nebraska: {
      cities: ["Omaha", "Lincoln", "Bellevue", "Grand Island"],
      minWages: {
        Omaha: 12.0,
        Lincoln: 12.0,
        Bellevue: 12.0,
        "Grand Island": 12.0,
      },
    },
    Nevada: {
      cities: ["Las Vegas", "Henderson", "Reno", "North Las Vegas"],
      minWages: {
        "Las Vegas": 12.0,
        Henderson: 12.0,
        Reno: 12.0,
        "North Las Vegas": 12.0,
      },
    },
    "New Hampshire": {
      cities: ["Manchester", "Nashua", "Concord", "Derry"],
      minWages: { Manchester: 7.25, Nashua: 7.25, Concord: 7.25, Derry: 7.25 },
    },
    "New Jersey": {
      cities: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison"],
      minWages: {
        Newark: 15.13,
        "Jersey City": 15.13,
        Paterson: 15.13,
        Elizabeth: 15.13,
        Edison: 15.13,
      },
    },
    "New Mexico": {
      cities: ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe"],
      minWages: {
        Albuquerque: 12.0,
        "Las Cruces": 12.0,
        "Rio Rancho": 12.0,
        "Santa Fe": 12.0,
      },
    },
    "New York": {
      cities: ["New York City", "Buffalo", "Rochester", "Syracuse", "Albany"],
      minWages: {
        "New York City": 16.5,
        Buffalo: 15.0,
        Rochester: 15.0,
        Syracuse: 15.0,
        Albany: 15.0,
      },
    },
    "North Carolina": {
      cities: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem"],
      minWages: {
        Charlotte: 7.25,
        Raleigh: 7.25,
        Greensboro: 7.25,
        Durham: 7.25,
        "Winston-Salem": 7.25,
      },
    },
    "North Dakota": {
      cities: ["Fargo", "Bismarck", "Grand Forks", "Minot"],
      minWages: {
        Fargo: 7.25,
        Bismarck: 7.25,
        "Grand Forks": 7.25,
        Minot: 7.25,
      },
    },
    Ohio: {
      cities: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron"],
      minWages: {
        Columbus: 10.45,
        Cleveland: 10.45,
        Cincinnati: 10.45,
        Toledo: 10.45,
        Akron: 10.45,
      },
    },
    Oklahoma: {
      cities: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow"],
      minWages: {
        "Oklahoma City": 7.25,
        Tulsa: 7.25,
        Norman: 7.25,
        "Broken Arrow": 7.25,
      },
    },
    Oregon: {
      cities: ["Portland", "Eugene", "Salem", "Gresham", "Hillsboro"],
      minWages: {
        Portland: 15.45,
        Eugene: 14.2,
        Salem: 14.2,
        Gresham: 15.45,
        Hillsboro: 15.45,
      },
    },
    Pennsylvania: {
      cities: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading"],
      minWages: {
        Philadelphia: 7.25,
        Pittsburgh: 7.25,
        Allentown: 7.25,
        Erie: 7.25,
        Reading: 7.25,
      },
    },
    "Rhode Island": {
      cities: ["Providence", "Warwick", "Cranston", "Pawtucket"],
      minWages: {
        Providence: 14.0,
        Warwick: 14.0,
        Cranston: 14.0,
        Pawtucket: 14.0,
      },
    },
    "South Carolina": {
      cities: ["Charleston", "Columbia", "North Charleston", "Mount Pleasant"],
      minWages: {
        Charleston: 7.25,
        Columbia: 7.25,
        "North Charleston": 7.25,
        "Mount Pleasant": 7.25,
      },
    },
    "South Dakota": {
      cities: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings"],
      minWages: {
        "Sioux Falls": 11.2,
        "Rapid City": 11.2,
        Aberdeen: 11.2,
        Brookings: 11.2,
      },
    },
    Tennessee: {
      cities: [
        "Nashville",
        "Memphis",
        "Knoxville",
        "Chattanooga",
        "Clarksville",
      ],
      minWages: {
        Nashville: 7.25,
        Memphis: 7.25,
        Knoxville: 7.25,
        Chattanooga: 7.25,
        Clarksville: 7.25,
      },
    },
    Texas: {
      cities: [
        "Houston",
        "San Antonio",
        "Dallas",
        "Austin",
        "Fort Worth",
        "El Paso",
      ],
      minWages: {
        Houston: 7.25,
        "San Antonio": 7.25,
        Dallas: 7.25,
        Austin: 7.25,
        "Fort Worth": 7.25,
        "El Paso": 7.25,
      },
    },
    Utah: {
      cities: ["Salt Lake City", "West Valley City", "Provo", "West Jordan"],
      minWages: {
        "Salt Lake City": 7.25,
        "West Valley City": 7.25,
        Provo: 7.25,
        "West Jordan": 7.25,
      },
    },
    Vermont: {
      cities: ["Burlington", "South Burlington", "Rutland", "Barre"],
      minWages: {
        Burlington: 13.67,
        "South Burlington": 13.67,
        Rutland: 13.67,
        Barre: 13.67,
      },
    },
    Virginia: {
      cities: [
        "Virginia Beach",
        "Norfolk",
        "Chesapeake",
        "Richmond",
        "Arlington",
      ],
      minWages: {
        "Virginia Beach": 12.0,
        Norfolk: 12.0,
        Chesapeake: 12.0,
        Richmond: 12.0,
        Arlington: 12.0,
      },
    },
    Washington: {
      cities: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue"],
      minWages: {
        Seattle: 19.97,
        Spokane: 16.28,
        Tacoma: 16.28,
        Vancouver: 16.28,
        Bellevue: 16.28,
      },
    },
    "Washington DC": { cities: ["Washington"], minWages: { Washington: 17.0 } },
    "West Virginia": {
      cities: ["Charleston", "Huntington", "Morgantown", "Parkersburg"],
      minWages: {
        Charleston: 8.75,
        Huntington: 8.75,
        Morgantown: 8.75,
        Parkersburg: 8.75,
      },
    },
    Wisconsin: {
      cities: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine"],
      minWages: {
        Milwaukee: 7.25,
        Madison: 7.25,
        "Green Bay": 7.25,
        Kenosha: 7.25,
        Racine: 7.25,
      },
    },
    Wyoming: {
      cities: ["Cheyenne", "Casper", "Laramie", "Gillette"],
      minWages: { Cheyenne: 7.25, Casper: 7.25, Laramie: 7.25, Gillette: 7.25 },
    },
  },
  "United Kingdom": {
    "England - London": { cities: ["London"], minWages: { London: 11.44 } },
    "England - South East": {
      cities: ["Brighton", "Southampton", "Portsmouth", "Reading", "Oxford"],
      minWages: {
        Brighton: 11.44,
        Southampton: 11.44,
        Portsmouth: 11.44,
        Reading: 11.44,
        Oxford: 11.44,
      },
    },
    "England - South West": {
      cities: ["Bristol", "Plymouth", "Exeter", "Bournemouth"],
      minWages: {
        Bristol: 11.44,
        Plymouth: 11.44,
        Exeter: 11.44,
        Bournemouth: 11.44,
      },
    },
    "England - West Midlands": {
      cities: ["Birmingham", "Coventry", "Wolverhampton"],
      minWages: { Birmingham: 11.44, Coventry: 11.44, Wolverhampton: 11.44 },
    },
    "England - East Midlands": {
      cities: ["Nottingham", "Leicester", "Derby"],
      minWages: { Nottingham: 11.44, Leicester: 11.44, Derby: 11.44 },
    },
    "England - East": {
      cities: ["Norwich", "Cambridge", "Peterborough"],
      minWages: { Norwich: 11.44, Cambridge: 11.44, Peterborough: 11.44 },
    },
    "England - North West": {
      cities: ["Manchester", "Liverpool", "Preston", "Chester"],
      minWages: {
        Manchester: 11.44,
        Liverpool: 11.44,
        Preston: 11.44,
        Chester: 11.44,
      },
    },
    "England - North East": {
      cities: ["Newcastle", "Sunderland", "Durham"],
      minWages: { Newcastle: 11.44, Sunderland: 11.44, Durham: 11.44 },
    },
    "England - Yorkshire": {
      cities: ["Leeds", "Sheffield", "Bradford", "York", "Hull"],
      minWages: {
        Leeds: 11.44,
        Sheffield: 11.44,
        Bradford: 11.44,
        York: 11.44,
        Hull: 11.44,
      },
    },
    Scotland: {
      cities: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Inverness"],
      minWages: {
        Edinburgh: 11.44,
        Glasgow: 11.44,
        Aberdeen: 11.44,
        Dundee: 11.44,
        Inverness: 11.44,
      },
    },
    Wales: {
      cities: ["Cardiff", "Swansea", "Newport", "Wrexham"],
      minWages: {
        Cardiff: 11.44,
        Swansea: 11.44,
        Newport: 11.44,
        Wrexham: 11.44,
      },
    },
    "Northern Ireland": {
      cities: ["Belfast", "Derry", "Lisburn"],
      minWages: { Belfast: 11.44, Derry: 11.44, Lisburn: 11.44 },
    },
  },
  Australia: {
    "New South Wales": {
      cities: ["Sydney", "Newcastle", "Wollongong", "Central Coast"],
      minWages: {
        Sydney: 24.1,
        Newcastle: 24.1,
        Wollongong: 24.1,
        "Central Coast": 24.1,
      },
    },
    Victoria: {
      cities: ["Melbourne", "Geelong", "Ballarat", "Bendigo"],
      minWages: {
        Melbourne: 24.1,
        Geelong: 24.1,
        Ballarat: 24.1,
        Bendigo: 24.1,
      },
    },
    Queensland: {
      cities: [
        "Brisbane",
        "Gold Coast",
        "Sunshine Coast",
        "Townsville",
        "Cairns",
      ],
      minWages: {
        Brisbane: 24.1,
        "Gold Coast": 24.1,
        "Sunshine Coast": 24.1,
        Townsville: 24.1,
        Cairns: 24.1,
      },
    },
    "Western Australia": {
      cities: ["Perth", "Mandurah", "Bunbury"],
      minWages: { Perth: 24.1, Mandurah: 24.1, Bunbury: 24.1 },
    },
    "South Australia": {
      cities: ["Adelaide", "Mount Gambier"],
      minWages: { Adelaide: 24.1, "Mount Gambier": 24.1 },
    },
    Tasmania: {
      cities: ["Hobart", "Launceston"],
      minWages: { Hobart: 24.1, Launceston: 24.1 },
    },
    "Northern Territory": {
      cities: ["Darwin", "Alice Springs"],
      minWages: { Darwin: 24.1, "Alice Springs": 24.1 },
    },
    "Australian Capital Territory": {
      cities: ["Canberra"],
      minWages: { Canberra: 24.1 },
    },
  },
};

interface JobRole {
  id: string;
  title: string;
  headcount: number;
  department: string;
}

interface ValidationError {
  field: string;
  message: string;
}

interface FloatingLabelInputProps {
  id: string;
  label: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  min?: number;
  error?: string;
  helperText?: string;
  tooltip?: string;
  required?: boolean;
}

const FloatingLabelInput = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  min,
  error,
  helperText,
  tooltip,
  required,
}: FloatingLabelInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== "" && value !== 0;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          min={min}
          className={`
            h-12 px-4 pt-6 pb-2
            bg-white/5 backdrop-blur-sm
            border-white/10 hover:border-white/20
            focus:border-white/20 focus:ring-1 focus:ring-white/20
            transition-all duration-200
            ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30" : ""}
          `}
          data-testid={`input-${id}`}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-required={required}
        />
        <Label
          htmlFor={id}
          className={`
            absolute left-4 top-1/2 -translate-y-1/2
            transition-all duration-200 pointer-events-none
            ${isFocused || hasValue ? "text-xs top-3 translate-y-0 opacity-60" : "text-sm opacity-60"}
            ${error ? "text-red-400" : "text-white"}
          `}
        >
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </Label>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  aria-label={`Help for ${label}`}
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          id={`${id}-error`}
          className="text-xs text-red-400 mt-1 flex items-center gap-1"
          role="alert"
        >
          <X className="w-3 h-3" />
          {error}
        </motion.p>
      )}
      {helperText && !error && (
        <p
          id={`${id}-helper`}
          className="text-white/40 mt-1"
          style={{ fontSize: '11px' }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

const STORAGE_KEY = "onspot-value-calculator-state";

const ROLE_PRESETS = [
  { label: "CS", title: "Customer Support", department: "customer-support" },
  { label: "TSR", title: "Technical Support", department: "technical-support" },
  { label: "Data", title: "Data Analyst", department: "data-entry" },
  { label: "Sales", title: "Sales Support", department: "sales-support" },
  { label: "VA", title: "Virtual Assistant", department: "virtual-assistant" },
];

const ShimmerSkeleton = ({ className }: { className?: string }) => (
  <div className={`relative overflow-hidden bg-white/5 rounded-lg ${className || ''}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

export default function WhyOnSpotValueCalculator() {
  const [country, setCountry] = useState<string>("United States");
  const [state, setState] = useState<string>("California");
  const [city, setCity] = useState<string>("San Francisco");
  const [minWage, setMinWage] = useState<number>(18.07);
  const [avgWorkHoursPerWeek, setAvgWorkHoursPerWeek] = useState<number>(40);
  const [annualWorkWeeks, setAnnualWorkWeeks] = useState<number>(52);
  const [benefits, setBenefits] = useState<number>(30);
  const [overhead, setOverhead] = useState<number>(25);
  const [productivityGainPercentage, setProductivityGainPercentage] = useState<
    number[]
  >([25]);
  const [managementFeePerSeat, setManagementFeePerSeat] = useState<number>(200);
  const [attritionRate, setAttritionRate] = useState<number>(15);
  const [growthRate, setGrowthRate] = useState<number>(20);
  const [timeHorizon, setTimeHorizon] = useState<number>(12);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([
    {
      id: "1",
      title: "Customer Support",
      headcount: 5,
      department: "customer-support",
    },
  ]);
  const [outsourcePercentage, setOutsourcePercentage] = useState<number[]>([
    50,
  ]);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50);

  const onspotRates = {
    "customer-support": 18000,
    "technical-support": 25000,
    "virtual-assistant": 15000,
    "data-entry": 12000,
    "sales-support": 22000,
    "back-office": 20000,
    accounting: 28000,
    marketing: 24000,
    hr: 26000,
    development: 35000,
  };

  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.country) setCountry(parsed.country);
        if (parsed.state) setState(parsed.state);
        if (parsed.city) setCity(parsed.city);
        if (parsed.minWage) setMinWage(parsed.minWage);
        if (parsed.jobRoles) setJobRoles(parsed.jobRoles);
        if (parsed.outsourcePercentage) setOutsourcePercentage(parsed.outsourcePercentage);
      } catch (e) {
        console.error("Failed to parse saved state:", e);
      }
    }
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      const stateToSave = {
        country,
        state,
        city,
        minWage,
        jobRoles,
        outsourcePercentage,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [country, state, city, minWage, jobRoles, outsourcePercentage]);

  const availableStates = useMemo(() => {
    if (!country || !locationData[country]) return [];
    return Object.keys(locationData[country]);
  }, [country]);

  const availableCities = useMemo(() => {
    if (!country || !state) return [];
    const countryData = locationData[country];
    if (!countryData) return [];
    const stateData = countryData[state];
    if (!stateData) return [];
    return stateData.cities;
  }, [country, state]);

  const handleCountryChange = (newCountry: string) => {
    setIsLocationLoading(true);
    setTimeout(() => {
      setCountry(newCountry);
      const states = Object.keys(locationData[newCountry] || {});
      if (states.length > 0) {
        const firstState = states[0];
        setState(firstState);
        const countryData = locationData[newCountry];
        const stateData = countryData[firstState];
        if (stateData && stateData.cities.length > 0) {
          const firstCity = stateData.cities[0];
          setCity(firstCity);
          setMinWage(stateData.minWages[firstCity] || 15.0);
        }
      }
      setIsLocationLoading(false);
    }, 150);
  };

  const handleStateChange = (newState: string) => {
    setIsLocationLoading(true);
    setTimeout(() => {
      setState(newState);
      const countryData = locationData[country];
      const stateData = countryData[newState];
      if (stateData && stateData.cities.length > 0) {
        const firstCity = stateData.cities[0];
        setCity(firstCity);
        setMinWage(stateData.minWages[firstCity] || 15.0);
      }
      setIsLocationLoading(false);
    }, 150);
  };

  const handleCityChange = (newCity: string) => {
    setIsLocationLoading(true);
    setTimeout(() => {
      setCity(newCity);
      const countryData = locationData[country];
      const stateData = countryData[state];
      if (stateData) {
        setMinWage(stateData.minWages[newCity] || 15.0);
      }
      setIsLocationLoading(false);
    }, 150);
  };

  const validateRole = (role: JobRole): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!role.title || role.title.trim() === "") {
      errors.push({ field: `role-${role.id}-title`, message: "Role title is required" });
    }
    if (role.headcount < 1) {
      errors.push({ field: `role-${role.id}-headcount`, message: "Headcount must be at least 1" });
    }
    return errors;
  };

  const addJobRole = () => {
    const newRole: JobRole = {
      id: Date.now().toString(),
      title: "",
      headcount: 1,
      department: "customer-support",
    };
    setJobRoles([...jobRoles, newRole]);
  };

  const addPresetRole = (preset: typeof ROLE_PRESETS[0]) => {
    const newRole: JobRole = {
      id: Date.now().toString(),
      title: preset.title,
      headcount: 1,
      department: preset.department,
    };
    setJobRoles([...jobRoles, newRole]);
  };

  const removeJobRole = (id: string) => {
    if (jobRoles.length > 1) {
      setJobRoles(jobRoles.filter((role) => role.id !== id));
      setValidationErrors(validationErrors.filter((err) => !err.field.includes(id)));
    }
  };

  const updateJobRole = (
    id: string,
    field: keyof JobRole,
    value: string | number,
  ) => {
    setJobRoles(
      jobRoles.map((role) =>
        role.id === id ? { ...role, [field]: value } : role,
      ),
    );
  };

  const handleRoleBlur = (role: JobRole) => {
    const errors = validateRole(role);
    setValidationErrors((prev) => [
      ...prev.filter((err) => !err.field.includes(role.id)),
      ...errors,
    ]);
  };

  const calculations = useMemo(() => {
    const hourlyRate = minWage;
    const annualHours = avgWorkHoursPerWeek * annualWorkWeeks;
    const totalTeamSize = jobRoles.reduce(
      (sum, role) => sum + role.headcount,
      0,
    );

    let totalInHouseCost = 0;
    let totalOnSpotCost = 0;

    jobRoles.forEach((role) => {
      const baseSalary = hourlyRate * annualHours;
      const benefitsCost = baseSalary * (benefits / 100);
      const overheadCost = baseSalary * (overhead / 100);
      const totalEmployeeCost = baseSalary + benefitsCost + overheadCost;

      const inHouseTeamCost = totalEmployeeCost * role.headcount;
      totalInHouseCost += inHouseTeamCost;

      const annualRateForDept =
        onspotRates[role.department as keyof typeof onspotRates] +
        managementFeePerSeat * 12;
      const onspotTeamCost = annualRateForDept * role.headcount;
      totalOnSpotCost += onspotTeamCost;
    });

    const avgCostPerEmployee = totalTeamSize > 0 ? totalInHouseCost / totalTeamSize : 0;
    const positionsToOutsource = Math.round(
      totalTeamSize * (outsourcePercentage[0] / 100),
    );
    const inHousePositions = totalTeamSize - positionsToOutsource;

    const currentAnnualCost = totalInHouseCost;
    const onspotAnnualCost =
      (totalOnSpotCost / totalTeamSize) * positionsToOutsource;
    const inHouseCostAfter =
      (totalInHouseCost / totalTeamSize) * inHousePositions;
    const totalNewAnnualCost = onspotAnnualCost + inHouseCostAfter;
    const annualSavings = currentAnnualCost - totalNewAnnualCost;
    const savingsPercentage = currentAnnualCost > 0 ? (annualSavings / currentAnnualCost) * 100 : 0;
    const roi = onspotAnnualCost > 0 ? (annualSavings / onspotAnnualCost) * 100 : 0;
    const totalSavings = annualSavings * (timeHorizon / 12);
    const compoundedSavings =
      annualSavings * (timeHorizon / 12) * (1 + growthRate / 100);
    const timeToValue = 21;
    const productivityGain =
      positionsToOutsource *
      (productivityGainPercentage[0] / 100) *
      avgCostPerEmployee;
    const efficiencyHours =
      positionsToOutsource * avgWorkHoursPerWeek * 52 * 0.25;

    return {
      currentAnnualCost,
      onspotAnnualCost,
      totalNewAnnualCost,
      annualSavings,
      savingsPercentage,
      roi,
      totalSavings,
      compoundedSavings,
      positionsToOutsource,
      totalTeamSize,
      timeToValue,
      productivityGain,
      efficiencyHours,
    };
  }, [
    jobRoles,
    minWage,
    avgWorkHoursPerWeek,
    annualWorkWeeks,
    benefits,
    overhead,
    outsourcePercentage,
    productivityGainPercentage,
    managementFeePerSeat,
    attritionRate,
    growthRate,
    timeHorizon,
  ]);

  const getLocaleByCountry = (country: string): string => {
    const localeMap: Record<string, string> = {
      "United States": "en-US",
      "Canada": "en-CA",
      "Australia": "en-AU",
      "United Kingdom": "en-GB",
    };
    return localeMap[country] || "en-US";
  };

  const formatCurrency = (amount: number) => {
    const locale = getLocaleByCountry(country);
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    
    const currencySymbol = formatted.match(/[^\d,.\s]+/)?.[0] || "$";
    const numberPart = formatted.replace(/[^\d,.\s]+/g, "").trim();
    
    return { symbol: currencySymbol, value: numberPart };
  };

  const formatNumber = (num: number) => {
    const locale = getLocaleByCountry(country);
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const formatCompactNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}m`.replace('.0m', 'm');
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`.replace('.0k', 'k');
    }
    return Math.round(num).toString();
  };

  const departmentHasBaseline = (department: string): boolean => {
    return department in onspotRates;
  };

  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches 
    : false;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
        staggerChildren: prefersReducedMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.3 },
    },
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.15),transparent_50%)] pointer-events-none" />
      
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay">
        <svg width="100%" height="100%">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <section className="relative py-16 px-6 bg-gradient-to-br from-[#625CCC]/10 via-background to-[#2D7FF9]/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#625CCC]/8 to-[#2D7FF9]/8 opacity-50 pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-sm font-medium mb-6">
              <Calculator className="w-4 h-4" />
              Value Calculator
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80">
              Calculate Your Savings
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              See how much you can save by outsourcing to OnSpot
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl"
          >
            <div className="grid grid-cols-12 gap-y-6 gap-x-6">
              <motion.div variants={itemVariants} className="col-span-12">
                <p className="text-xs uppercase tracking-wider text-white/60 mb-4">
                  Location Details
                </p>
                <div className="h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0 mb-6" />
              </motion.div>

              <motion.div variants={itemVariants} className="col-span-12 md:col-span-4">
                <div className="relative">
                  <Label
                    htmlFor="country"
                    className="text-xs uppercase tracking-wider text-white/60 mb-3 block"
                  >
                    Country
                  </Label>
                  {isLocationLoading ? (
                    <ShimmerSkeleton className="h-12" />
                  ) : (
                    <Select
                      value={country}
                      onValueChange={handleCountryChange}
                    >
                      <SelectTrigger 
                        id="country"
                        data-testid="select-country" 
                        className="h-12 bg-white/5 border-white/10 hover:border-white/20 focus:border-white/20 transition-all duration-200"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(locationData).map((c: string) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="col-span-12 md:col-span-4">
                <div className="relative">
                  <Label
                    htmlFor="state"
                    className="text-xs uppercase tracking-wider text-white/60 mb-3 block"
                  >
                    State/Province
                  </Label>
                  {isLocationLoading ? (
                    <ShimmerSkeleton className="h-12" />
                  ) : (
                    <Select value={state} onValueChange={handleStateChange}>
                      <SelectTrigger 
                        id="state"
                        data-testid="select-state" 
                        className="h-12 bg-white/5 border-white/10 hover:border-white/20 focus:border-white/20 transition-all duration-200"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStates.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="col-span-12 md:col-span-4">
                <div className="relative">
                  <Label
                    htmlFor="city"
                    className="text-xs uppercase tracking-wider text-white/60 mb-3 block"
                  >
                    City
                  </Label>
                  {isLocationLoading ? (
                    <ShimmerSkeleton className="h-12" />
                  ) : (
                    <Select value={city} onValueChange={handleCityChange}>
                      <SelectTrigger 
                        id="city"
                        data-testid="select-city" 
                        className="h-12 bg-white/5 border-white/10 hover:border-white/20 focus:border-white/30 transition-all duration-200"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCities.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-white/40 mt-2" style={{ fontSize: '11px' }}>
                    We'll load local wage baselines for your area
                  </p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="col-span-12 mt-6">
                <p className="text-xs uppercase tracking-wider text-white/60 mb-4">
                  Team Composition
                </p>
                <div className="h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0 mb-6" />
              </motion.div>

              <div className="col-span-12">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-white/90">
                      Job Roles
                    </Label>
                    <Badge variant="secondary" className="text-xs">
                      {jobRoles.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addJobRole}
                    className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                    data-testid="button-add-role"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Custom
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {ROLE_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      onClick={() => addPresetRole(preset)}
                      className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/80 transition-all duration-150"
                      data-testid={`button-preset-${preset.label.toLowerCase()}`}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {preset.label}
                    </Button>
                  ))}
                </div>

                <AnimatePresence mode="popLayout">
                  <div className="space-y-4">
                    {jobRoles.map((role, index) => (
                      <motion.div
                        key={role.id}
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        transition={{
                          duration: prefersReducedMotion ? 0 : (index === jobRoles.length - 1 ? 0.16 : 0.12),
                          ease: "easeOut",
                        }}
                        className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-white/20 transition-all duration-200"
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 relative">
                              <FloatingLabelInput
                                id={`role-title-${role.id}`}
                                label="Role Title"
                                value={role.title}
                                onChange={(e) =>
                                  updateJobRole(role.id, "title", e.target.value)
                                }
                                onBlur={() => handleRoleBlur(role)}
                                error={validationErrors.find(e => e.field === `role-${role.id}-title`)?.message}
                                required
                              />
                            </div>
                            {jobRoles.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeJobRole(role.id)}
                                className="mt-1 text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                                data-testid={`button-remove-role-${role.id}`}
                                aria-label={`Remove ${role.title} role`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FloatingLabelInput
                              id={`role-headcount-${role.id}`}
                              label="Headcount"
                              type="number"
                              min={1}
                              value={role.headcount}
                              onChange={(e) =>
                                updateJobRole(
                                  role.id,
                                  "headcount",
                                  Math.max(1, Number(e.target.value)),
                                )
                              }
                              tooltip="Number of people in this role"
                            />
                            <div className="relative">
                              <Label className="text-xs uppercase tracking-wider text-white/60 mb-3 block">
                                Department
                              </Label>
                              <Select
                                value={role.department}
                                onValueChange={(value) =>
                                  updateJobRole(role.id, "department", value)
                                }
                              >
                                <SelectTrigger
                                  className="h-12 bg-white/5 border-white/10 hover:border-white/20 focus:border-white/30 transition-all duration-200"
                                  data-testid={`select-role-department-${role.id}`}
                                  aria-label={`Department for ${role.title}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="customer-support">
                                    Customer Support
                                  </SelectItem>
                                  <SelectItem value="technical-support">
                                    Technical Support
                                  </SelectItem>
                                  <SelectItem value="virtual-assistant">
                                    Virtual Assistant
                                  </SelectItem>
                                  <SelectItem value="data-entry">
                                    Data Entry
                                  </SelectItem>
                                  <SelectItem value="sales-support">
                                    Sales Support
                                  </SelectItem>
                                  <SelectItem value="back-office">
                                    Back Office
                                  </SelectItem>
                                  <SelectItem value="accounting">
                                    Accounting
                                  </SelectItem>
                                  <SelectItem value="marketing">
                                    Marketing
                                  </SelectItem>
                                  <SelectItem value="hr">
                                    Human Resources
                                  </SelectItem>
                                  <SelectItem value="development">
                                    Development
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {departmentHasBaseline(role.department) && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="flex items-center gap-1 mt-2 text-xs text-emerald-400"
                                >
                                  <Check className="w-3 h-3" />
                                  Linked to baseline rate
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              </div>

              <motion.div variants={itemVariants} className="col-span-12 mt-6">
                <div className="relative" ref={sliderRef}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-white/90">
                        Outsource Percentage
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="text-white/40 hover:text-white/70 transition-colors"
                              aria-label="Help for outsource percentage"
                            >
                              <HelpCircle className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm max-w-xs">
                              What percentage of your team do you want to outsource to OnSpot?
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <motion.div
                      className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-sm font-semibold text-primary"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 0.2 }}
                      key={outsourcePercentage[0]}
                    >
                      {outsourcePercentage[0]}%
                    </motion.div>
                  </div>
                  <div className="relative py-4">
                    <Slider
                      value={outsourcePercentage}
                      onValueChange={setOutsourcePercentage}
                      max={100}
                      step={10}
                      className="w-full [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-primary/30 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-2 [&_[role=slider]]:border-white/20"
                      data-testid="slider-outsource-percentage"
                      aria-label="Outsource percentage"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/40 mt-2">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-12">
                  <div className="text-center mb-12">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: prefersReducedMotion ? 0 : 0.5 }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6"
                    >
                      <Sparkles className="w-4 h-4" />
                      Your Value Analysis
                    </motion.div>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: prefersReducedMotion ? 0 : 0.3, duration: prefersReducedMotion ? 0 : 0.5 }}
                      className="text-4xl md:text-5xl font-bold mb-16"
                    >
                      Projected Results
                    </motion.h2>
                  </div>

                  <div className="grid md:grid-cols-3 gap-8 mb-16">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: prefersReducedMotion ? 0 : 0.5 }}
                      className="text-center p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 flex flex-col items-center justify-center space-y-3 min-h-[200px]"
                    >
                      <div className="text-lg md:text-xl text-primary/60 font-medium">
                        $
                      </div>
                      <div
                        className="font-bold text-primary whitespace-nowrap"
                        style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}
                        data-testid="text-annual-savings"
                      >
                        {formatCompactNumber(calculations.annualSavings)}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Annual Savings
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: prefersReducedMotion ? 0 : 0.5, duration: prefersReducedMotion ? 0 : 0.5 }}
                      className="text-center p-8 rounded-2xl bg-gradient-to-br from-[hsl(var(--gold-yellow))]/5 to-[hsl(var(--gold-yellow))]/10 flex flex-col items-center justify-center space-y-3 min-h-[200px]"
                    >
                      <TrendingUp className="w-6 h-6 md:w-7 md:h-7 text-[hsl(var(--gold-yellow))]/60" />
                      <div
                        className="font-bold text-[hsl(var(--gold-yellow))] whitespace-nowrap"
                        style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}
                        data-testid="text-savings-percentage"
                      >
                        {formatPercentage(calculations.savingsPercentage)}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Cost Reduction
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: prefersReducedMotion ? 0 : 0.6, duration: prefersReducedMotion ? 0 : 0.5 }}
                      className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-500/5 to-blue-500/10 flex flex-col items-center justify-center space-y-3 min-h-[200px]"
                    >
                      <Clock className="w-6 h-6 md:w-7 md:h-7 text-blue-600/60" />
                      <div
                        className="font-bold text-blue-600 whitespace-nowrap"
                        style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}
                        data-testid="text-efficiency-hours"
                      >
                        {formatCompactNumber(calculations.efficiencyHours)}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Efficiency Hours/Year
                      </div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: prefersReducedMotion ? 0 : 0.7, duration: prefersReducedMotion ? 0 : 0.5 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                  >
                    <Button
                      size="lg"
                      className="text-base px-8"
                      data-testid="button-get-started"
                    >
                      Get Started
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-base px-8"
                      data-testid="button-download-report"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download Report
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          <Collapsible open={assumptionsOpen} onOpenChange={setAssumptionsOpen}>
            <Card>
              <CollapsibleTrigger className="w-full" data-testid="button-assumptions-toggle">
                <CardHeader className="hover-elevate active-elevate-2 cursor-pointer">
                  <CardTitle className="text-xl flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-muted-foreground" />
                      Calculation Details & Assumptions
                    </span>
                    <motion.div
                      animate={{ rotate: assumptionsOpen ? 180 : 0 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
                    >
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Cost Breakdown
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                          <span className="text-sm font-medium">
                            Current Annual Cost
                          </span>
                          <span className="font-bold">
                            {formatCurrency(calculations.currentAnnualCost).symbol}
                            {formatCurrency(calculations.currentAnnualCost).value}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                          <span className="text-sm font-medium">
                            OnSpot Annual Cost
                          </span>
                          <span className="font-bold">
                            {formatCurrency(calculations.onspotAnnualCost).symbol}
                            {formatCurrency(calculations.onspotAnnualCost).value}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                          <span className="text-sm font-medium text-primary">
                            New Total Cost
                          </span>
                          <span className="font-bold text-primary">
                            {formatCurrency(calculations.totalNewAnnualCost).symbol}
                            {formatCurrency(calculations.totalNewAnnualCost).value}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Team Details
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                          <span className="text-sm font-medium">
                            Total Team Size
                          </span>
                          <span className="font-bold">
                            {calculations.totalTeamSize}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                          <span className="text-sm font-medium">
                            Positions Outsourced
                          </span>
                          <span className="font-bold">
                            {calculations.positionsToOutsource}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                            Time to Value
                          </span>
                          <span className="font-bold text-blue-700 dark:text-blue-400">
                            {calculations.timeToValue} days
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Input Parameters
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted/20 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          Benefits
                        </div>
                        <div className="font-semibold">{benefits}%</div>
                      </div>
                      <div className="p-4 bg-muted/20 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          Overhead
                        </div>
                        <div className="font-semibold">{overhead}%</div>
                      </div>
                      <div className="p-4 bg-muted/20 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          Productivity Gain
                        </div>
                        <div className="font-semibold">
                          {productivityGainPercentage[0]}%
                        </div>
                      </div>
                      <div className="p-4 bg-muted/20 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          Management Fee
                        </div>
                        <div className="font-semibold">
                          ${managementFeePerSeat}/mo
                        </div>
                      </div>
                      <div className="p-4 bg-muted/20 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          Growth Rate
                        </div>
                        <div className="font-semibold">{growthRate}%</div>
                      </div>
                      <div className="p-4 bg-muted/20 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          Time Horizon
                        </div>
                        <div className="font-semibold">{timeHorizon} months</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Projection
                    </h3>
                    <div className="p-6 bg-gradient-to-br from-primary/5 to-muted/5 rounded-lg">
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold text-primary mb-1">
                          {formatCurrency(calculations.compoundedSavings).symbol}
                          {formatCurrency(calculations.compoundedSavings).value}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {timeHorizon}-month projection with {growthRate}% growth
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold mb-1">Base Savings</div>
                          <div className="text-muted-foreground">
                            {formatCurrency(calculations.totalSavings).symbol}
                            {formatCurrency(calculations.totalSavings).value}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold mb-1">Growth Value</div>
                          <div className="text-muted-foreground">
                            {(() => {
                              const growthValue = calculations.compoundedSavings - calculations.totalSavings;
                              const formatted = formatCurrency(growthValue);
                              return `${formatted.symbol}${formatted.value}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-background/80 backdrop-blur-lg border-t border-border p-4 safe-area-inset-bottom z-50">
        <Button
          size="lg"
          className="w-full"
          data-testid="button-calculate-mobile"
        >
          Calculate Savings
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
