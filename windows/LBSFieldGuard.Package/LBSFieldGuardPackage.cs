using Microsoft.ReactNative;

namespace LBSFieldGuard
{
    /// <summary>
    /// ReactPackage that registers the PCAPBridge native module.
    /// Add an instance of this class in App.cpp ReactPackageProviders.
    /// </summary>
    public sealed class LBSFieldGuardPackage : IReactPackage
    {
        public void CreateNativeModules(IReactModulesBuilder modulesBuilder)
        {
            modulesBuilder.AddModule<PCAPBridgeModule>();
        }
    }
}
