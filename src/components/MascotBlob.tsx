export default function MascotBlob() {
  return (
    <div className="mascot-blob absolute w-[200px] h-[180px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[3]">
      <div className="mascot-blob-body w-full h-full bg-coral relative">
        <div className="mascot-antenna absolute -top-5 left-1/2 -translate-x-1/2 w-[3px] h-[30px] bg-coral-dark rounded-[3px]" />
        <div className="mascot-eyes absolute top-[35%] left-1/2 -translate-x-1/2 flex gap-6">
          <div className="mascot-eye w-8 h-9 bg-white rounded-full relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <div className="mascot-pupil absolute w-4 h-4 bg-charcoal rounded-full top-[10px] left-1/2 -translate-x-1/2" />
            <div className="mascot-eye-shine absolute w-1.5 h-1.5 bg-white rounded-full top-[10px] right-1.5 z-[1]" />
          </div>
          <div className="mascot-eye w-8 h-9 bg-white rounded-full relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <div className="mascot-pupil absolute w-4 h-4 bg-charcoal rounded-full top-[10px] left-1/2 -translate-x-1/2" />
            <div className="mascot-eye-shine absolute w-1.5 h-1.5 bg-white rounded-full top-[10px] right-1.5 z-[1]" />
          </div>
        </div>
        <div className="mascot-mouth absolute top-[62%] left-1/2 -translate-x-1/2 w-10 h-5 border-b-4 border-charcoal border-l-4 border-l-transparent border-r-4 border-r-transparent rounded-b-[50%]" />
        <div className="mascot-arm mascot-arm-left absolute w-[50px] h-5 bg-coral-dark rounded-[30px] top-[55%] z-[2] -left-5 -rotate-[20deg]" />
        <div className="mascot-arm mascot-arm-right absolute w-[50px] h-5 bg-coral-dark rounded-[30px] top-[55%] z-[2] -right-5 rotate-[20deg]" />
      </div>
    </div>
  );
}
