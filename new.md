I just finished up clearing previous version of this website where we initially created this as a way to improve AI suggestions for your website by inserting reddit  
 comments. but this approach felt not enough first due to reddit not 100% working, but also that it feels not enough of a feature to be worth paying for considering  
 the alternatives. so now I'm redogin this from scratch so I removed all schema for previous one so that I can from the beginning create something that can be  
 extended as we go. this is how it worked before for reddit: user created a "campaign", they entered their website, we use google gemini flash to analyze the site and  
 keywords we could search for in reddit and like what it offers so later when comments are generated we know, then the keyword is searched using scrapecreators api  
 for reddit we keep that in cache using sqllite db(the list one we save for like 6 hours but the detail we save permanently unless we specify cache busting), then  
 these posts are sent to a ranker which checks if they're even relevant to the site the user put in and gives it a score(I think this part can be improved btw) and  
 then it goes to a comment generator using claude opus 4.6 which generates the comment(there's multiple /Users/govind/Documents/slopmog/src/constants/personas.ts  
 personas here for reddit specifically), and once the coment is generated the user can choose to approve it which will use upvotemax(for reddit specifically) to post  
 that comment(we still have it over here:/Users/govind/Documents/slopmog/src/services/posting/upvotemax.ts ) and now for other providers we have  
 socialplug(/Users/govind/Documents/slopmog/src/services/posting/socialplug.ts ) . also I kinda don't really want the user to be overwhelmed by the oppurtunities and  
 have to click buttons to actually do things, like anything that a person oculd decide an LLM can also decide(opus) but in the beginning we probably want to not  
 automatically spam a bunch of stuff since we will be testing if everything works couple of times with a bunch of sites or maybe even same site. \  
 \  
 \  
 now what I actually want to do is have a way to do multiple at the same time. so user can select which ones they want and we should handle everything, which ones as  
 in reddit, twitter, youtube, threads, instagram, tiktok, but I can acknowledge that this is kind of a lot to start with and you'll probably run out of context if  
 you try all of them at the same time. so I think I want reddit done, I know how it was done so I can improve it if you get off, youtube I created a sort of mvp  
 script so you could follow some of that for implementation: /Users/govind/Documents/slopmog/scripts/youtube-discover.ts  
 /Users/govind/Documents/slopmog/scripts/youtube-post.ts  
 /Users/govind/Documents/slopmog/scripts/twitter-discover.ts\
 \  
 same with twitter. just know that different platforms will have different way of having like daily oppurtunities aslo thats a major change from before. before we  
 were just randomly scraping just about everything which is not a good idea. I think I want to make this tool into a sort of daily thing, where it can act  
 autonomously(later) where it auto finds oppurtunities(which can be multiple, like direct feature recommendation, someone promoting a competitor, or even slightly  
 unrelated thing where someone is asking for recommendation or maybe someone has made a list and our thing is not on there). in terms of difference, reddit as I  
 showed earlier is pretty easy to figure out, we search using keywords for just 1 day filter(on scrapecreators api directly, not filtered on our side) which should  
 get us a list of threads we could score if they're relevant and if adding our site makes sense(ofc not directly "try this" but like answering the question and subtly  
 putting it in, more info in the persona part I think). twitter has a bit of a different way cause there we can't really do search for keyword, there we have to  
 somehow find out where people talking about X topic gather in terms of community, or follow in terms of accounts. suggest an inventive way to do this.

    help me figure out this plan, I'm still a bit unsure and this site is still in the works so anything is possible to add, remove replace, dont worry
