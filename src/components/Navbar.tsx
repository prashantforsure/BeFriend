import React, { useState } from 'react'
import Link from "next/link"
import { Button } from "./ui/button"
import { UserAccountNav } from "./UserAccountNav"
import { signIn, signOut, useSession } from 'next-auth/react'
import { Menu, X } from 'lucide-react'

const Navbar = () => {
    const { data: session, status } = useSession()
    const [isMenuOpen, setIsMenuOpen] = useState(false)

 

    const handleAuthAction = () => {
      if (session) {
        signOut()
      } else {
        signIn()
      }
    }
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                ScriptLoom
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <Link href="#features" className="text-slate-700 hover:text-purple-600 transition-colors">
                Features
              </Link>
              <Link href="#workflow" className="text-slate-700 hover:text-purple-600 transition-colors">
                Workflow
              </Link>
              <Link href="#testimonials" className="text-slate-700 hover:text-purple-600 transition-colors">
                Testimonials
              </Link>
              
            </nav>

            <div className="hidden md:flex items-center space-x-4">
            <div className='flex items-center gap-4'>
          {session?.user ? (
            <>
              <div className="hidden md:flex items-center gap-4">
               
               
              </div>
              
              <UserAccountNav user={{
                ...session.user,
                image: session.user.image ?? "",
                name: session.user.name ?? "",   
                email: session.user.email ?? ""  
              }} />
            </>
          ) : (
            <Link href='/auth/signin'>
              <Button
                variant="ghost" 
                className='rounded-md px-6 py-2 text-white bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 transition-all duration-300 ease-in-out hover:shadow-[0_0_15px_rgba(236,72,153,0.5)] hover:-translate-y-0.5'
              >
                Sign In
              </Button>
            </Link>
          )}
        </div>
        <Link href="/dashboard">
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors shadow-md hover:shadow-lg">
              Get Started
              </button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md text-slate-700 hover:text-purple-600 hover:bg-slate-100"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                href="#features"
                className="block px-3 py-2 text-slate-700 hover:text-purple-600 hover:bg-slate-100 rounded-md"
              >
                Features
              </Link>
              <Link
                href="#workflow"
                className="block px-3 py-2 text-slate-700 hover:text-purple-600 hover:bg-slate-100 rounded-md"
              >
                Workflow
              </Link>
              <Link
                href="#testimonials"
                className="block px-3 py-2 text-slate-700 hover:text-purple-600 hover:bg-slate-100 rounded-md"
              >
                Testimonials
              </Link>
              <Link
                href="#pricing"
                className="block px-3 py-2 text-slate-700 hover:text-purple-600 hover:bg-slate-100 rounded-md"
              >
                Pricing
              </Link>
              <div className="pt-4 pb-3 border-t border-slate-200">
              <div className='flex items-center gap-4'>
          {session?.user ? (
            <>
              <div className="hidden md:flex items-center gap-4">
               
               
              </div>
              
              <UserAccountNav user={{
                ...session.user,
                image: session.user.image ?? "",
                name: session.user.name ?? "",   
                email: session.user.email ?? ""  
              }} />
            </>
          ) : (
            <Link href='/auth/signin'>
              <Button 
                variant="ghost" 
                className='rounded-md px-6 py-2 text-white bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 transition-all duration-300 ease-in-out hover:shadow-[0_0_15px_rgba(236,72,153,0.5)] hover:-translate-y-0.5'
              >
                Sign In
              </Button>
            </Link>
          )}
        </div>
                <button className="w-full mt-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

  )
}

export default Navbar