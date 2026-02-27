// LBS FieldGuard — Windows Native Module (react-native-windows)
// PCAPBridge.cs — bridges WinPcap/Npcap packet capture to JS via NativeModule

using System;
using System.Collections.Generic;
using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Foundation;
using Microsoft.ReactNative.ManagedCodeGen;
using Microsoft.ReactNative;
using SharpPcap;
using PacketDotNet;

namespace LBSFieldGuard
{
    /// <summary>
    /// Windows NativeModule: PCAPBridge
    /// Provides startCapture(iface) / stopCapture() to JS.
    /// Emits 'onPacket' events with { srcIp, dstIp, proto, srcPort, dstPort, payloadHex, length }.
    ///
    /// Requires: SharpPcap + PacketDotNet NuGet packages.
    /// Requires: Npcap installed on the target Windows machine.
    /// </summary>
    [ReactModule("PCAPBridge")]
    public class PCAPBridgeModule
    {
        private IReactContext _reactContext;
        private ICaptureDevice _device;

        [ReactInitializer]
        public void Initialize(IReactContext context)
        {
            _reactContext = context;
        }

        [ReactMethod("startCapture")]
        public void StartCapture(string iface, IReactPromise<JSValue> promise)
        {
            try
            {
                var devices = CaptureDeviceList.Instance;
                if (devices.Count == 0)
                {
                    promise.Reject(new ReactError { Message = "No capture devices found (is Npcap installed?)" });
                    return;
                }

                // Use first device unless a specific interface name is given
                _device = devices[0];
                foreach (var d in devices)
                {
                    if (d.Name.Contains(iface, StringComparison.OrdinalIgnoreCase))
                    {
                        _device = d;
                        break;
                    }
                }

                _device.OnPacketArrival += OnPacketArrival;
                _device.Open(DeviceModes.Promiscuous, 1000);
                _device.StartCapture();
                promise.Resolve(JSValue.Null);
            }
            catch (Exception ex)
            {
                promise.Reject(new ReactError { Message = ex.Message });
            }
        }

        [ReactMethod("stopCapture")]
        public void StopCapture()
        {
            try
            {
                _device?.StopCapture();
                _device?.Close();
            }
            catch { }
        }

        private void OnPacketArrival(object sender, PacketCapture e)
        {
            try
            {
                var raw = e.GetPacket();
                var packet = Packet.ParsePacket(raw.LinkLayerType, raw.Data);
                var ip = packet.Extract<IPPacket>();
                if (ip == null) return;

                string srcIp   = ip.SourceAddress.ToString();
                string dstIp   = ip.DestinationAddress.ToString();
                int proto      = (int)ip.Protocol;
                int srcPort    = 0;
                int dstPort    = 0;
                string payHex  = "";

                var tcp = packet.Extract<TcpPacket>();
                var udp = packet.Extract<UdpPacket>();

                if (tcp != null)
                {
                    srcPort = tcp.SourcePort;
                    dstPort = tcp.DestinationPort;
                    payHex  = BitConverter.ToString(tcp.PayloadData ?? Array.Empty<byte>())
                               .Replace("-", "").ToLower();
                }
                else if (udp != null)
                {
                    srcPort = udp.SourcePort;
                    dstPort = udp.DestinationPort;
                    payHex  = BitConverter.ToString(udp.PayloadData ?? Array.Empty<byte>())
                               .Replace("-", "").ToLower();
                }

                // Trim payload to 256 bytes for event (full copy not needed for detection)
                if (payHex.Length > 512) payHex = payHex.Substring(0, 512);

                var ev = new JSValueObject
                {
                    ["srcIp"]      = srcIp,
                    ["dstIp"]      = dstIp,
                    ["proto"]      = proto,
                    ["srcPort"]    = srcPort,
                    ["dstPort"]    = dstPort,
                    ["payloadHex"] = payHex,
                    ["length"]     = raw.Data.Length,
                };

                _reactContext.EmitJSEvent("RCTDeviceEventEmitter", "onPacket", ev);
            }
            catch { /* non-critical — skip malformed packet */ }
        }
    }
}
