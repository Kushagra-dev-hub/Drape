"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GiftCandidate } from "@/lib/gifts";
import Link from "next/link";
import { ArrowLeftIcon } from "../components/icons";

type SavedAddress = {
  id: string;
  label: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  pincode: string;
  is_default: boolean;
};

// We need a wrapper to useSearchParams safely inside Suspense
function CheckoutFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messageId = searchParams.get("messageId");
  const giftId = searchParams.get("giftId");

  const [gift, setGift] = useState<GiftCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1); // 1 = Address, 2 = Order Summary
  
  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [saveThisAddress, setSaveThisAddress] = useState(true);
  const [addressLabel, setAddressLabel] = useState("Home");
  const [savingAddress, setSavingAddress] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  
  // Form State
  const [address, setAddress] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    pincode: "",
  });

  const supabase = createClient();

  // Load gift details + saved addresses on mount
  useEffect(() => {
    async function loadData() {
      // Load gift
      if (messageId && giftId) {
        const { data, error } = await supabase
          .from("messages")
          .select("gifts")
          .eq("id", messageId)
          .single();
          
        if (!error && data?.gifts) {
          const found = (data.gifts as GiftCandidate[]).find((g: GiftCandidate) => g.id === giftId);
          if (found) setGift(found);
        }
      }
      
      // Load saved addresses for logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: addresses } = await supabase
          .from("saved_addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (addresses && addresses.length > 0) {
          setSavedAddresses(addresses);
          // Auto-select the default address, or the first one
          const defaultAddr = addresses.find((a: SavedAddress) => a.is_default) || addresses[0];
          setSelectedAddressId(defaultAddr.id);
          setAddress({
            name: defaultAddr.name,
            phone: defaultAddr.phone,
            street: defaultAddr.street,
            city: defaultAddr.city,
            pincode: defaultAddr.pincode,
          });
        } else {
          setShowAddressForm(true);
        }
      } else {
        setShowAddressForm(true);
      }
      
      setLoading(false);
    }
    
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, giftId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[--color-surface]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[--color-primary]/20 border-t-[--color-primary]"></div>
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[--color-surface]">
        <h1 className="text-xl font-bold text-[--color-text]">Gift not found</h1>
        <button onClick={() => router.back()} className="gradient-button rounded-xl px-6 py-2.5 text-white font-medium">
          Go Back
        </button>
      </div>
    );
  }

  function selectSavedAddress(addr: SavedAddress) {
    setSelectedAddressId(addr.id);
    setAddress({
      name: addr.name,
      phone: addr.phone,
      street: addr.street,
      city: addr.city,
      pincode: addr.pincode,
    });
    setShowAddressForm(false);
  }

  function startNewAddress() {
    setSelectedAddressId(null);
    setAddress({ name: "", phone: "", street: "", city: "", pincode: "" });
    setShowAddressForm(true);
    setSaveThisAddress(true);
  }

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // If using a new address and user wants to save it
    if (showAddressForm && saveThisAddress && !selectedAddressId) {
      setSavingAddress(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const isFirst = savedAddresses.length === 0;
        const { data: newAddr, error } = await supabase
          .from("saved_addresses")
          .insert({
            user_id: user.id,
            label: addressLabel,
            name: address.name,
            phone: address.phone,
            street: address.street,
            city: address.city,
            pincode: address.pincode,
            is_default: isFirst,
          })
          .select()
          .single();
        
        if (!error && newAddr) {
          setSavedAddresses((prev) => [newAddr, ...prev]);
          setSelectedAddressId(newAddr.id);
        }
      }
      setSavingAddress(false);
    }
    
    setStep(2);
  }

  async function handleDeleteAddress(id: string) {
    await supabase.from("saved_addresses").delete().eq("id", id);
    setSavedAddresses((prev) => prev.filter((a) => a.id !== id));
    if (selectedAddressId === id) {
      const remaining = savedAddresses.filter((a) => a.id !== id);
      if (remaining.length > 0) {
        selectSavedAddress(remaining[0]);
      } else {
        startNewAddress();
      }
    }
  }

  const handlePlaceOrder = async () => {
    if (!gift) return;
    setPlacingOrder(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("orders").insert({
        user_id: user.id,
        gift_id: gift.id,
        gift_name: gift.name,
        gift_image_url: gift.imageUrl || null,
        merchant: gift.merchant,
        price: gift.price,
        delivery_days: gift.deliveryDays,
        status: "Processing",
      });
    }
    
    setPlacingOrder(false);
    alert("Order placed successfully!"); // Feedback for the user
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[--color-surface] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[--color-border] bg-white/80 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-black/5 transition-colors">
            <ArrowLeftIcon className="h-5 w-5 text-[--color-text-secondary]" />
          </button>
          <div className="text-xl font-bold tracking-tight text-[--color-primary]">
            Memento <span className="font-normal text-[--color-text-tertiary]">Checkout</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8 sm:px-8">
        {/* Stepper */}
        <div className="mb-10 flex items-center justify-center gap-4 sm:gap-8">
          <div className={`flex flex-col items-center gap-2 ${step >= 1 ? "text-[--color-primary]" : "text-[--color-text-tertiary]"}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${step >= 1 ? "bg-[#0A2F2A] text-white shadow-md" : "bg-black/5"}`}>
              1
            </div>
            <span className="text-sm font-semibold">Address</span>
          </div>
          <div className={`h-1 w-16 sm:w-32 rounded-full ${step >= 2 ? "bg-[#0A2F2A]" : "bg-black/10"}`} />
          <div className={`flex flex-col items-center gap-2 ${step >= 2 ? "text-[--color-primary]" : "text-[--color-text-tertiary]"}`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${step >= 2 ? "bg-[#0A2F2A] text-white shadow-md" : "bg-black/5"}`}>
              2
            </div>
            <span className="text-sm font-semibold">Order Summary</span>
          </div>
          <div className={`h-1 w-16 sm:w-32 rounded-full bg-black/10`} />
          <div className={`flex flex-col items-center gap-2 text-[--color-text-tertiary] opacity-50`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold bg-black/5`}>
              3
            </div>
            <span className="text-sm font-semibold">Payment</span>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Left Column (Forms) */}
          <div className="flex-1 space-y-6">
            {/* Step 1: Address */}
            <div className={`glass-card overflow-hidden rounded-2xl transition-all duration-300 ${step === 1 ? "ring-2 ring-[--color-primary] ring-offset-2" : ""}`}>
              <div className="flex items-center justify-between border-b border-[--color-border] bg-white/40 px-6 py-4">
                <h2 className="text-lg font-bold text-[--color-text]">Delivery Address</h2>
                {step > 1 && (
                  <button onClick={() => setStep(1)} className="text-sm font-medium text-[--color-primary-muted] hover:underline">
                    Change
                  </button>
                )}
              </div>
              
              {step === 1 ? (
                <div className="p-6">
                  {/* Saved addresses list */}
                  {savedAddresses.length > 0 && (
                    <div className="mb-6 flex flex-col gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">Saved Addresses</span>
                      {savedAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          onClick={() => selectSavedAddress(addr)}
                          className={`group relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 ${
                            selectedAddressId === addr.id && !showAddressForm
                              ? "border-[--color-primary] bg-[#0A2F2A]/5 shadow-sm"
                              : "border-[--color-border] hover:border-[--color-border-hover] hover:bg-[--color-surface]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {/* Radio indicator */}
                              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                selectedAddressId === addr.id && !showAddressForm
                                  ? "border-[--color-primary]"
                                  : "border-[--color-text-tertiary]"
                              }`}>
                                {selectedAddressId === addr.id && !showAddressForm && (
                                  <div className="h-2.5 w-2.5 rounded-full bg-[#0A2F2A]" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[--color-text]">
                                  {addr.name}
                                  <span className="ml-2 rounded bg-[--color-accent-mint]/40 px-2 py-0.5 text-xs font-medium text-[--color-primary-muted]">
                                    {addr.label}
                                  </span>
                                </p>
                                <p className="mt-1 text-sm text-[--color-text-secondary]">{addr.street}, {addr.city} {addr.pincode}</p>
                                <p className="mt-0.5 text-sm text-[--color-text-secondary]">{addr.phone}</p>
                              </div>
                            </div>
                            {/* Delete button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                              className="hidden shrink-0 rounded-lg p-1.5 text-[--color-text-tertiary] transition-colors hover:bg-red-50 hover:text-red-500 group-hover:block"
                              aria-label="Delete address"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Add new address button */}
                      {!showAddressForm && (
                        <button
                          onClick={startNewAddress}
                          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[--color-border-hover] p-4 text-sm font-medium text-[--color-primary-muted] transition-colors hover:border-[--color-primary] hover:bg-[--color-primary]/5"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Add a new address
                        </button>
                      )}
                    </div>
                  )}

                  {/* Address form (for new address or when no saved addresses) */}
                  {showAddressForm && (
                    <form onSubmit={handleAddressSubmit} className="flex flex-col gap-4">
                      {savedAddresses.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-tertiary]">New Address</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddressForm(false);
                              if (savedAddresses.length > 0) {
                                selectSavedAddress(savedAddresses[0]);
                              }
                            }}
                            className="text-xs font-medium text-[--color-primary-muted] hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-[--color-text-secondary]">Full Name</label>
                          <input required value={address.name} onChange={e => setAddress({...address, name: e.target.value})} className="glass-input rounded-xl px-4 py-2.5 text-sm text-[--color-text] focus:outline-none" placeholder="Yash Verma" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-[--color-text-secondary]">Phone Number</label>
                          <input required type="tel" value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} className="glass-input rounded-xl px-4 py-2.5 text-sm text-[--color-text] focus:outline-none" placeholder="10-digit number" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[--color-text-secondary]">Street Address</label>
                        <textarea required value={address.street} onChange={e => setAddress({...address, street: e.target.value})} rows={2} className="glass-input resize-none rounded-xl px-4 py-2.5 text-sm text-[--color-text] focus:outline-none" placeholder="House/Flat No., Building, Street, Area" />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-[--color-text-secondary]">City / District</label>
                          <input required value={address.city} onChange={e => setAddress({...address, city: e.target.value})} className="glass-input rounded-xl px-4 py-2.5 text-sm text-[--color-text] focus:outline-none" placeholder="City" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-[--color-text-secondary]">Pincode</label>
                          <input required value={address.pincode} onChange={e => setAddress({...address, pincode: e.target.value})} className="glass-input rounded-xl px-4 py-2.5 text-sm text-[--color-text] focus:outline-none" placeholder="e.g. 208011" />
                        </div>
                      </div>

                      {/* Address label selector */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-[--color-text-secondary]">Label</label>
                        <div className="flex gap-2">
                          {["Home", "Work", "Other"].map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setAddressLabel(l)}
                              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                                addressLabel === l
                                  ? "bg-[#0A2F2A] text-white shadow-sm"
                                  : "bg-black/5 text-[--color-text-secondary] hover:bg-black/10"
                              }`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Save address checkbox */}
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[--color-surface] p-3">
                        <input
                          type="checkbox"
                          checked={saveThisAddress}
                          onChange={(e) => setSaveThisAddress(e.target.checked)}
                          className="h-4 w-4 rounded border-[--color-border] accent-[--color-primary]"
                        />
                        <span className="text-sm font-medium text-[--color-text-secondary]">
                          Save this address for future orders
                        </span>
                      </label>

                      <div className="mt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={savingAddress}
                          className="gradient-button rounded-xl px-8 py-3 text-sm font-bold text-white shadow-md transition-transform active:scale-95 disabled:opacity-60"
                        >
                          {savingAddress ? "Saving…" : "Deliver Here"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Submit for saved address selection (no form shown) */}
                  {!showAddressForm && selectedAddressId && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => setStep(2)}
                        className="gradient-button rounded-xl px-8 py-3 text-sm font-bold text-white shadow-md transition-transform active:scale-95"
                      >
                        Deliver Here
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-sm text-[--color-text]">
                  <p className="font-semibold">
                    {address.name}
                    <span className="ml-2 rounded bg-[--color-accent-mint]/40 px-2 py-0.5 text-xs font-medium text-[--color-primary-muted]">
                      {savedAddresses.find((a) => a.id === selectedAddressId)?.label || addressLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-[--color-text-secondary]">{address.street}, {address.city} {address.pincode}</p>
                  <p className="mt-1 text-[--color-text-secondary]">{address.phone}</p>
                </div>
              )}
            </div>

            {/* Step 2: Order Summary */}
            <div className={`glass-card overflow-hidden rounded-2xl transition-all duration-300 ${step === 2 ? "ring-2 ring-[--color-primary] ring-offset-2" : "opacity-80"}`}>
              <div className="border-b border-[--color-border] bg-white/40 px-6 py-4">
                <h2 className="text-lg font-bold text-[--color-text]">Order Summary</h2>
              </div>
              
              {step === 2 ? (
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:gap-6">
                  <div className="aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-black/5">
                    {gift.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={gift.imageUrl} alt={gift.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl">{gift.emoji}</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <h3 className="font-semibold text-[--color-text]">{gift.name}</h3>
                    <p className="text-sm text-[--color-text-tertiary]">{gift.merchant}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-lg font-bold text-[--color-success]">₹{gift.price.toLocaleString("en-IN")}</span>
                      <span className="text-sm text-[--color-text-tertiary] line-through">₹{Math.round(gift.price * 1.5).toLocaleString("en-IN")}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[--color-primary-muted]">Delivery in {gift.deliveryDays} days</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-sm text-[--color-text-tertiary]">
                  Please complete the previous steps to view your order.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Price Details) */}
          <div className="glass-card sticky top-24 w-full rounded-2xl lg:w-96">
            <div className="border-b border-[--color-border] bg-white/40 px-6 py-4">
              <h2 className="text-base font-bold uppercase tracking-wider text-[--color-text-secondary]">Price Details</h2>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex justify-between text-sm text-[--color-text]">
                <span>Price (1 item)</span>
                <span>₹{Math.round(gift.price * 1.5).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm text-[--color-text]">
                <span>Discount</span>
                <span className="text-[--color-success]">- ₹{Math.round(gift.price * 0.5).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm text-[--color-text]">
                <span>Delivery Charges</span>
                <span className="text-[--color-success]">Free</span>
              </div>
              
              <div className="my-2 h-px w-full bg-[--color-border]" />
              
              <div className="flex justify-between text-lg font-bold text-[--color-text]">
                <span>Total Amount</span>
                <span>₹{gift.price.toLocaleString("en-IN")}</span>
              </div>
              
              <div className="my-2 h-px w-full bg-[--color-border]" />
              
              <div className="text-sm font-medium text-[--color-success]">
                You will save ₹{Math.round(gift.price * 0.5).toLocaleString("en-IN")} on this order
              </div>

              {step === 2 && (
                <button
                  onClick={handlePlaceOrder}
                  disabled={placingOrder}
                  className="gradient-accent-button mt-4 w-full rounded-xl py-3.5 text-base font-bold text-[--color-text] shadow-md transition-transform hover:shadow-lg active:scale-95 disabled:opacity-60"
                >
                  {placingOrder ? "Placing Order..." : "Continue"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[--color-surface]"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[--color-primary]/20 border-t-[--color-primary]"></div></div>}>
      <CheckoutFlow />
    </Suspense>
  );
}
