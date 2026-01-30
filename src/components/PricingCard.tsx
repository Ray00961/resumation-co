import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function PricingCard() {
  const [isLoading, setIsLoading] = useState(false);

  const handlePaymobPayment = async () => {
    setIsLoading(true);
    try {
      // 1. Authentication Request
      const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: "ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR0Z6Y3lJNklrMWxjbU5vWVc1MElpd2ljSEp2Wm1sc1pWOXdheUk2TVRFeU1UVTNPQ3dpYm1GdFpTSTZJbWx1YVhScFlXd2lmUS5aWVo3SlIxWENjOE5xa1RFMk9BV0pQSkJuVGgxbEpQVGZTcTlTTG9BVS1TWDVrdDN6TlZRTGNQREZhT2xNb2szY2p2Z3F1NEZMRVc0QWRVMDMzUGpQZw==" })
      });
      const { token } = await authRes.json();

      // 2. Order Registration
      const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          delivery_needed: "false",
          amount_cents: "100", // تجربة بـ 1 جنيه مصري
          currency: "EGP",
          items: []
        })
      });
      const { id: orderId } = await orderRes.json();

      // 3. Payment Key Request
      const keyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: token,
          amount_cents: "100",
          expiration: 3600,
          order_id: orderId,
          billing_data: {
            apartment: "NA", email: "test@resumation.co", floor: "NA",
            first_name: "User", street: "NA", building: "NA",
            phone_number: "+201000000000", shipping_method: "NA",
            postal_code: "NA", city: "Cairo", country: "EG", last_name: "Test", state: "Cairo"
          },
          currency: "EGP",
          integration_id: 5463147 // الـ ID الخاص بك
        })
      });
      const { token: paymentToken } = await keyRes.json();

      // 4. Redirect to your specified Iframe (995359)
      window.location.href = `https://accept.paymob.com/api/acceptance/iframes/995359?payment_token=${paymentToken}`;

    } catch (error) {
      console.error("Paymob Error:", error);
      alert("Something went wrong. Please check your internet or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-20 text-center">
      <button 
        onClick={handlePaymobPayment}
        disabled={isLoading}
        className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold text-xl hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
      >
        {isLoading ? <Loader2 className="animate-spin" /> : "Pay with Credit Card 💳"}
      </button>
    </section>
  );
}